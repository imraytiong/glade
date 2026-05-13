use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use crate::gemini::{self, GeminiRequest, Content, Part, SystemInstruction};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
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
                tools: None,
            }
        );
        
        registry.agents.insert(
            "refactor".to_string(),
            Agent {
                id: "refactor".to_string(),
                name: "Refactor".to_string(),
                system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.".to_string(),
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
    
    let request = GeminiRequest {
        contents: vec![Content {
            role: "user".to_string(),
            parts,
        }],
        system_instruction: Some(SystemInstruction {
            parts: vec![Part::Text(agent.system_prompt.clone())]
        }),
        tools: agent.tools.clone(),
    };
    
    let response = gemini::call_gemini(api_key, model, &request, base_url).await.map_err(|e| e.to_string())?;
    
    let text = response.candidates
        .and_then(|mut c| c.pop())
        .and_then(|c| c.content)
        .and_then(|mut c| c.parts.take())
        .and_then(|mut p| p.pop())
        .and_then(|p| p.text)
        .unwrap_or_else(|| "No response generated.".to_string());
        
    tracing::info!(
        target: "agent_execution",
        agent_id = %agent.id,
        response_len = text.len(),
        "Agent execution completed successfully"
    );
        
    Ok(text)
}

#[tauri::command]
pub async fn invoke_agent(
    agent_id: String,
    query: String,
    context: String,
    state: tauri::State<'_, AgentRegistry>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let agent = state.agents.get(&agent_id).ok_or("Agent not found")?;
    
    let stores = app_handle.store("settings.json").map_err(|e| format!("Failed to access store: {}", e))?;
    
    // Explicitly load the store from disk if needed
    let _ = stores.reload();
    
    let api_key_val = stores.get("gemini_api_key").ok_or("Gemini API Key not set in Settings")?;
    let api_key = api_key_val.as_str().ok_or("Invalid API Key format")?;
    
    let model = stores.get("gemini_model")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "gemini-2.5-flash".to_string());
    
    execute_agent(agent, api_key, &model, &query, &context, None).await
}

#[cfg(test)]
mod tests;
