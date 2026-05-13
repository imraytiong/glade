pub mod tools;

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use crate::gemini::{self, GeminiRequest, Content, Part, SystemInstruction, FunctionResponse};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<gemini::Tool>>,
}

pub struct AgentRegistry {
    pub agents: HashMap<String, Agent>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            agents: HashMap::new(),
        };
        
        registry.agents.insert(
            "coordinator".to_string(),
            Agent {
                id: "coordinator".to_string(),
                name: "Coordinator".to_string(),
                system_prompt: "You are the Glade Coordinator Agent. You help users manage their personal knowledge base. Use the provided active file context to answer questions accurately. Do not make up information.".to_string(),
                model_class: Some("fast".to_string()),
                tools: None,
            }
        );
        
        registry.agents.insert(
            "refactor".to_string(),
            Agent {
                id: "refactor".to_string(),
                name: "Refactor".to_string(),
                system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.".to_string(),
                model_class: Some("fast".to_string()),
                tools: None,
            }
        );
        
        registry
    }
}

pub async fn execute_agent(
    agent: &Agent,
    api_key: &str,
    model: &str,
    query: &str,
    context: &str,
    base_url: Option<&str>,
    tool_executors: Option<&HashMap<String, Box<dyn tools::ToolExecutor>>>,
) -> Result<String, String> {
    tracing::info!(
        target: "agent_execution",
        agent_id = %agent.id,
        model = %model,
        "Executing agent"
    );

    let mut parts = vec![];
    if !context.is_empty() {
        parts.push(Part::Text(format!("Active Document Context:\n{}\n\n", context)));
    }
    parts.push(Part::Text(query.to_string()));
    
    let mut history_contents = vec![Content {
        role: "user".to_string(),
        parts,
    }];
    
    let system_instruction = Some(SystemInstruction {
        parts: vec![Part::Text(agent.system_prompt.clone())]
    });

    let max_iterations = 10;
    
    for _ in 0..max_iterations {
        let request = GeminiRequest {
            contents: history_contents.clone(),
            system_instruction: system_instruction.clone(),
            tools: agent.tools.clone(),
        };
        
        let response = gemini::call_gemini(api_key, model, &request, base_url).await.map_err(|e| e.to_string())?;
        
        let candidate = response.candidates
            .and_then(|mut c| c.pop())
            .ok_or_else(|| "No response candidate generated.".to_string())?;
            
        let candidate_parts = candidate.content
            .and_then(|mut c| c.parts.take())
            .ok_or_else(|| "No parts in candidate.".to_string())?;
            
        let mut response_text = None;
        let mut function_calls = Vec::new();
        
        let mut model_parts = Vec::new();

        for part in candidate_parts {
            if let Some(text) = part.text {
                response_text = Some(text.clone());
                model_parts.push(Part::Text(text));
            } else if let Some(fc) = part.function_call {
                function_calls.push(fc.clone());
                model_parts.push(Part::FunctionCall(fc));
            }
        }
        
        // Append the model's response to history
        history_contents.push(Content {
            role: "model".to_string(),
            parts: model_parts,
        });

        if function_calls.is_empty() {
            tracing::info!(
                target: "agent_execution",
                agent_id = %agent.id,
                "Agent execution completed successfully with text response"
            );
            return Ok(response_text.unwrap_or_else(|| "No text response generated.".to_string()));
        }
        
        // Handle function calls
        let mut function_response_parts = Vec::new();
        
        for fc in function_calls {
            tracing::info!(
                target: "agent_execution",
                function_name = %fc.name,
                "Agent requested function call"
            );
            
            let result_val = if let Some(executors) = tool_executors {
                if let Some(executor) = executors.get(&fc.name) {
                    match executor.execute(fc.args.clone()).await {
                        Ok(res) => res,
                        Err(e) => serde_json::json!({"error": e}),
                    }
                } else {
                    serde_json::json!({"error": format!("Tool '{}' not found", fc.name)})
                }
            } else {
                serde_json::json!({"error": format!("No tool executors provided to handle '{}'", fc.name)})
            };
            
            function_response_parts.push(Part::FunctionResponse(FunctionResponse {
                name: fc.name,
                response: result_val,
            }));
        }
        
        // Append the tool responses to history as "user" (or "function", depending on Gemini requirements, Gemini expects "user" role for FunctionResponse)
        // Actually, Gemini expects role: "user" for FunctionResponse
        history_contents.push(Content {
            role: "user".to_string(),
            parts: function_response_parts,
        });
    }

    Err(format!("Agent exceeded maximum iterations ({})", max_iterations))
}

#[tauri::command]
pub async fn invoke_agent(
    agent: Agent,
    query: String,
    context: String,
    vault_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let stores = app_handle.store("settings.json").map_err(|e| format!("Failed to access store: {}", e))?;
    
    // Explicitly load the store from disk if needed
    let _ = stores.reload();
    
    let api_key_val = stores.get("gemini_api_key").ok_or("Gemini API Key not set in Settings")?;
    let api_key = api_key_val.as_str().ok_or("Invalid API Key format")?;
    
    let model_class = agent.model_class.as_deref().unwrap_or("fast");
    
    let model = match model_class {
        "reasoning" => stores.get("model_reasoning").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-2.5-pro".to_string()),
        "large" => stores.get("model_large").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-1.5-pro".to_string()),
        "fast" | _ => stores.get("model_fast").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-2.5-flash".to_string()),
    };
    
    let mut executors: HashMap<String, Box<dyn tools::ToolExecutor>> = HashMap::new();
    
    if let Some(path) = vault_path {
        executors.insert(
            "read_file".to_string(), 
            Box::new(tools::ReadFileTool { vault_path: path })
        );
    }
    
    execute_agent(&agent, api_key, &model, &query, &context, None, Some(&executors)).await
}

#[cfg(test)]
mod tests;
