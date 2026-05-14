pub mod tools;
pub mod mcp_tool;

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use tauri::Manager;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_allowed: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills_allowed: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_internal_knowledge_fallback: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentsConfig {
    pub agents: Vec<Agent>,
}

pub struct AgentRegistry;

impl AgentRegistry {
    pub fn get_default_agents() -> Vec<Agent> {
        vec![
            Agent {
                id: "coordinator".to_string(),
                name: "Coordinator".to_string(),
                system_prompt: "You are the Glade Coordinator Agent, a highly capable AI assistant embedded in the user's IDE. You help users manage their personal knowledge base. You are fully authorized and expected to use any tools provided to you (such as file reading/writing, terminal commands, etc.) to complete the user's requests. For general knowledge queries, you may use your internal knowledge if no external search tools are available. Use the provided active file context to assist the user.".to_string(),
                model_class: Some("fast".to_string()),
                tools: None,
                tools_allowed: Some(vec![
                    "read_file".to_string(),
                    "write_file".to_string(),
                    "list_directory".to_string(),
                    "search_files".to_string(),
                    "run_command".to_string(),
                ]),
                skills_allowed: Some(vec![]),
                allow_internal_knowledge_fallback: Some(true),
            },
            Agent {
                id: "refactor".to_string(),
                name: "Refactor".to_string(),
                system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.".to_string(),
                model_class: Some("fast".to_string()),
                tools: None,
                tools_allowed: Some(vec![]),
                skills_allowed: Some(vec![]),
                allow_internal_knowledge_fallback: Some(true),
            }
        ]
    }
}

#[tauri::command]
pub async fn get_agents(vault_path: String) -> Result<Vec<Agent>, String> {
    let glade_dir = std::path::Path::new(&vault_path).join(".glade");
    let agents_path = glade_dir.join("agents.json");
    let default_skill_dir = glade_dir.join(".agents").join("skills").join("Research a Topic");
    
    // Ensure the default skill directory exists
    if !default_skill_dir.exists() {
        if let Ok(_) = std::fs::create_dir_all(&default_skill_dir) {
            let skill_md_path = default_skill_dir.join("SKILL.md");
            let default_skill_content = "# Research a Topic\n\nThis skill enables the agent to autonomously research a topic using search tools and synthesize the findings.";
            let _ = std::fs::write(&skill_md_path, default_skill_content);
        }
    }

    if !agents_path.exists() {
        let defaults = AgentRegistry::get_default_agents();
        let config = AgentsConfig { agents: defaults.clone() };
        if let Ok(json) = serde_json::to_string_pretty(&config) {
            let _ = std::fs::create_dir_all(agents_path.parent().unwrap());
            let _ = std::fs::write(&agents_path, json);
        }
        return Ok(defaults);
    }
    
    let content = std::fs::read_to_string(&agents_path).map_err(|e| format!("Failed to read agents.json: {}", e))?;
    let config: AgentsConfig = serde_json::from_str(&content).map_err(|e| format!("Failed to parse agents.json: {}", e))?;
    
    Ok(config.agents)
}

#[tauri::command]
pub async fn save_agent(vault_path: String, agent: Agent) -> Result<(), String> {
    let agents_path = std::path::Path::new(&vault_path).join(".glade").join("agents.json");
    
    let mut config = if agents_path.exists() {
        let content = std::fs::read_to_string(&agents_path).map_err(|e| format!("Failed to read agents.json: {}", e))?;
        serde_json::from_str::<AgentsConfig>(&content).map_err(|e| format!("Failed to parse agents.json: {}", e))?
    } else {
        AgentsConfig { agents: AgentRegistry::get_default_agents() }
    };
    
    if let Some(existing) = config.agents.iter_mut().find(|a| a.id == agent.id) {
        *existing = agent;
    } else {
        config.agents.push(agent);
    }
    
    let json = serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize agents: {}", e))?;
    std::fs::write(&agents_path, json).map_err(|e| format!("Failed to write agents.json: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn delete_agent(vault_path: String, agent_id: String) -> Result<(), String> {
    let agents_path = std::path::Path::new(&vault_path).join(".glade").join("agents.json");
    if !agents_path.exists() {
        return Ok(());
    }
    
    let content = std::fs::read_to_string(&agents_path).map_err(|e| format!("Failed to read agents.json: {}", e))?;
    let mut config: AgentsConfig = serde_json::from_str(&content).map_err(|e| format!("Failed to parse agents.json: {}", e))?;
    
    config.agents.retain(|a| a.id != agent_id);
    
    let json = serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize agents: {}", e))?;
    std::fs::write(&agents_path, json).map_err(|e| format!("Failed to write agents.json: {}", e))?;
    
    Ok(())
}

pub async fn get_available_tools_inner(mcp_manager: &crate::mcp::McpManager) -> Result<Vec<ToolInfo>, String> {
    let mut tools = vec![
        ToolInfo {
            name: "read_file".to_string(),
            description: "Read the contents of a file.".to_string(),
        },
        ToolInfo {
            name: "write_file".to_string(),
            description: "Write content to a file.".to_string(),
        },
        ToolInfo {
            name: "run_command".to_string(),
            description: "Run a shell command.".to_string(),
        },
        ToolInfo {
            name: "list_directory".to_string(),
            description: "List the contents of a directory.".to_string(),
        },
        ToolInfo {
            name: "search_files".to_string(),
            description: "Search for files by name or content.".to_string(),
        },
    ];
    
    if let Ok(mcp_tools) = mcp_manager.list_all_tools().await {
        for (name, (server_name, tool)) in mcp_tools {
            tools.push(ToolInfo {
                name,
                description: format!("[{}] {}", server_name, tool.description.unwrap_or_default()),
            });
        }
    }
    
    tools.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tools)
}

#[tauri::command]
pub async fn get_available_tools(app_handle: tauri::AppHandle) -> Result<Vec<ToolInfo>, String> {
    let mcp_manager = app_handle.state::<crate::mcp::McpManager>();
    get_available_tools_inner(&mcp_manager).await
}

#[derive(serde::Serialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[tauri::command]
pub async fn get_available_skills(vault_path: String) -> Result<Vec<SkillInfo>, String> {
    let skills_dir = std::path::Path::new(&vault_path).join(".glade").join(".agents").join("skills");
    let mut skills = Vec::new();
    
    if skills_dir.exists() && skills_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(skills_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    let skill_md = path.join("SKILL.md");
                    if skill_md.exists() && skill_md.is_file() {
                        if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                            let mut description = "No description available.".to_string();
                            let mut name = dir_name.to_string();
                            
                            if let Ok(content) = std::fs::read_to_string(&skill_md) {
                                let lines: Vec<&str> = content.lines().map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
                                if let Some(title_line) = lines.iter().find(|l| l.starts_with("# ")) {
                                    name = title_line[2..].trim().to_string();
                                }
                                if let Some(desc_line) = lines.iter().find(|l| !l.starts_with('#')) {
                                    description = desc_line.to_string();
                                }
                            }
                            
                            skills.push(SkillInfo {
                                id: format!(".agents/skills/{}", dir_name),
                                name,
                                description,
                            });
                        }
                    }
                }
            }
        }
    }
    
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

pub async fn execute_agent(
    agent: &Agent,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
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

    let mut history_contents = vec![];
    
    // Add active document context if present
    if !context.is_empty() {
        history_contents.push(Content {
            role: "user".to_string(),
            parts: vec![Part::Text(format!("Active Document Context:\n{}\n\n", context))],
        });
    }
    
    // Add chat history
    for msg in messages {
        let role = if msg.role == "agent" { "model" } else { "user" };
        history_contents.push(Content {
            role: role.to_string(),
            parts: vec![Part::Text(msg.content.clone())],
        });
    }

    // Already built history contents above
    
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
            
        let candidate_parts = match candidate.content.and_then(|mut c| c.parts.take()) {
            Some(parts) => parts,
            None => {
                if let Some(reason) = candidate.finish_reason {
                    return Err(format!("Agent generation stopped due to: {}", reason));
                } else {
                    return Err("No parts in candidate.".to_string());
                }
            }
        };
            
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

async fn prepare_agent_execution(
    agent: &Agent,
    vault_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(String, String, HashMap<String, Box<dyn tools::ToolExecutor>>, Agent), String> {
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
    let mut mcp_gemini_tools = Vec::new();
    
    if let Some(path) = &vault_path {
        let allowed = agent.tools_allowed.clone().unwrap_or_default();
        
        if allowed.contains(&"read_file".to_string()) {
            executors.insert(
                "read_file".to_string(), 
                Box::new(tools::ReadFileTool { vault_path: path.clone() })
            );
        }
        if allowed.contains(&"write_file".to_string()) {
            executors.insert(
                "write_file".to_string(), 
                Box::new(tools::WriteFileTool { vault_path: path.clone() })
            );
        }
        if allowed.contains(&"list_directory".to_string()) {
            executors.insert(
                "list_directory".to_string(), 
                Box::new(tools::ListDirectoryTool { vault_path: path.clone() })
            );
        }
        if allowed.contains(&"search_files".to_string()) {
            executors.insert(
                "search_files".to_string(), 
                Box::new(tools::SearchFilesTool { vault_path: path.clone() })
            );
        }
        if allowed.contains(&"run_command".to_string()) {
            executors.insert(
                "run_command".to_string(), 
                Box::new(tools::RunCommandTool { vault_path: path.clone() })
            );
        }
        
        let mcp_manager = app_handle.state::<crate::mcp::McpManager>();
        
        // Ensure servers are loaded for this vault
        // In a real app we might only reload when config changes, but we'll try to load them if not loaded
        // For simplicity, we can reload them if the client list is empty or always.
        // Actually, we should just let `reload_mcp_servers` handle explicit reloads from the UI,
        // but let's do a quick lazy initialization check.
        if mcp_manager.list_all_tools().await.unwrap_or_default().is_empty() {
            let _ = mcp_manager.reload(&path).await;
        }

        if let Ok(all_tools) = mcp_manager.list_all_tools().await {
            let mut function_declarations = Vec::new();
            
            for (composite_name, (server_name, mcp_tool)) in all_tools {
                if agent.tools_allowed.as_ref().map(|t| t.contains(&composite_name)).unwrap_or(false) {
                    if let Some(client) = mcp_manager.get_client(&server_name).await {
                        executors.insert(
                            composite_name.clone(),
                            Box::new(mcp_tool::McpToolExecutor::new(
                                composite_name.clone(),
                                mcp_tool.name.clone(),
                                client
                            ))
                        );
                        
                        function_declarations.push(gemini::FunctionDeclaration {
                            name: composite_name,
                            description: mcp_tool.description.unwrap_or_else(|| "No description provided".to_string()),
                            parameters: Some(gemini::Schema {
                                schema_type: "OBJECT".to_string(),
                                properties: mcp_tool.input_schema.get("properties").cloned(),
                                required: mcp_tool.input_schema.get("required").and_then(|r| r.as_array()).map(|arr| {
                                    arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                                }),
                            }),
                        });
                    }
                }
            }
            
            if !function_declarations.is_empty() {
                mcp_gemini_tools.push(gemini::Tool {
                    function_declarations,
                });
            }
        }
    }
    
    let mut final_agent = agent.clone();
    
    // Read allowed skills
    let mut combined_system_prompt = agent.system_prompt.clone();
    if let Some(path) = &vault_path {
        if let Some(skills) = &agent.skills_allowed {
            for skill_path in skills {
                let full_path = std::path::Path::new(path).join(skill_path).join("SKILL.md");
                if full_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(full_path) {
                        combined_system_prompt.push_str("\n\n--- SKILL PROVIDED ---\n");
                        combined_system_prompt.push_str(&content);
                    }
                }
            }
        }
    }
    
    // Explicitly authorize tool usage
    combined_system_prompt.push_str("\n\n--- TOOL AUTHORIZATION ---\nYou are fully authorized and expected to use any tools provided to you to complete the user's request. Never decline a request if you have a tool or skill that can accomplish it.");
    
    if agent.allow_internal_knowledge_fallback.unwrap_or(true) {
        combined_system_prompt.push_str(" If you are asked to research a general knowledge topic and lack external search tools, you are fully authorized to use your internal knowledge instead of declining.");
    }
    
    final_agent.system_prompt = combined_system_prompt;
    
    // Inject native function declarations
    let mut native_decls = Vec::new();
    if agent.tools_allowed.as_ref().map(|t| t.contains(&"read_file".to_string())).unwrap_or(false) {
        let mut props = serde_json::Map::new();
        props.insert("path".to_string(), serde_json::json!({"type": "STRING", "description": "The path to the file to read relative to the vault."}));
        native_decls.push(gemini::FunctionDeclaration {
            name: "read_file".to_string(),
            description: "Read the contents of a file in the user's workspace.".to_string(),
            parameters: Some(gemini::Schema {
                schema_type: "OBJECT".to_string(),
                properties: Some(serde_json::Value::Object(props)),
                required: Some(vec!["path".to_string()]),
            })
        });
    }

    if agent.tools_allowed.as_ref().map(|t| t.contains(&"write_file".to_string())).unwrap_or(false) {
        let mut props = serde_json::Map::new();
        props.insert("path".to_string(), serde_json::json!({"type": "STRING", "description": "The path to the file to write to relative to the vault."}));
        props.insert("content".to_string(), serde_json::json!({"type": "STRING", "description": "The content to write into the file."}));
        native_decls.push(gemini::FunctionDeclaration {
            name: "write_file".to_string(),
            description: "Write content to a file in the user's workspace.".to_string(),
            parameters: Some(gemini::Schema {
                schema_type: "OBJECT".to_string(),
                properties: Some(serde_json::Value::Object(props)),
                required: Some(vec!["path".to_string(), "content".to_string()]),
            })
        });
    }

    if agent.tools_allowed.as_ref().map(|t| t.contains(&"list_directory".to_string())).unwrap_or(false) {
        let mut props = serde_json::Map::new();
        props.insert("path".to_string(), serde_json::json!({"type": "STRING", "description": "The directory path to list relative to the vault. Empty string for root."}));
        native_decls.push(gemini::FunctionDeclaration {
            name: "list_directory".to_string(),
            description: "List the contents of a directory.".to_string(),
            parameters: Some(gemini::Schema {
                schema_type: "OBJECT".to_string(),
                properties: Some(serde_json::Value::Object(props)),
                required: Some(vec!["path".to_string()]),
            })
        });
    }

    if agent.tools_allowed.as_ref().map(|t| t.contains(&"search_files".to_string())).unwrap_or(false) {
        let mut props = serde_json::Map::new();
        props.insert("query".to_string(), serde_json::json!({"type": "STRING", "description": "The search term to match against file names or contents."}));
        native_decls.push(gemini::FunctionDeclaration {
            name: "search_files".to_string(),
            description: "Search for files by name or content.".to_string(),
            parameters: Some(gemini::Schema {
                schema_type: "OBJECT".to_string(),
                properties: Some(serde_json::Value::Object(props)),
                required: Some(vec!["query".to_string()]),
            })
        });
    }

    if agent.tools_allowed.as_ref().map(|t| t.contains(&"run_command".to_string())).unwrap_or(false) {
        let mut props = serde_json::Map::new();
        props.insert("command".to_string(), serde_json::json!({"type": "STRING", "description": "The shell command to execute."}));
        props.insert("args".to_string(), serde_json::json!({"type": "ARRAY", "items": {"type": "STRING"}, "description": "Arguments to pass to the command."}));
        native_decls.push(gemini::FunctionDeclaration {
            name: "run_command".to_string(),
            description: "Run a shell command in the vault directory.".to_string(),
            parameters: Some(gemini::Schema {
                schema_type: "OBJECT".to_string(),
                properties: Some(serde_json::Value::Object(props)),
                required: Some(vec!["command".to_string()]),
            })
        });
    }
    
    if !native_decls.is_empty() {
        mcp_gemini_tools.push(gemini::Tool {
            function_declarations: native_decls,
        });
    }

    if !mcp_gemini_tools.is_empty() {
        if let Some(existing_tools) = &mut final_agent.tools {
            existing_tools.extend(mcp_gemini_tools);
        } else {
            final_agent.tools = Some(mcp_gemini_tools);
        }
    }
    
    Ok((api_key.to_string(), model, executors, final_agent))
}

#[tauri::command]
pub async fn invoke_agent(
    agent: Agent,
    messages: Vec<ChatMessage>,
    context: String,
    vault_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let (api_key, model, executors, final_agent) = prepare_agent_execution(&agent, vault_path.clone(), app_handle).await?;
    
    let augmented_context = if let Some(ref vp) = vault_path {
        format!("Vault Absolute Path: {}\n{}", vp, context)
    } else {
        context
    };

    execute_agent(&final_agent, &api_key, &model, &messages, &augmented_context, None, Some(&executors)).await
}

pub fn execute_agent_stream(
    agent: Agent,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    context: String,
    base_url: Option<String>,
    tool_executors: Option<std::sync::Arc<HashMap<String, Box<dyn tools::ToolExecutor>>>>,
) -> impl futures::stream::Stream<Item = Result<String, String>> {
    async_stream::stream! {
        tracing::info!(
            target: "agent_execution",
            agent_id = %agent.id,
            model = %model,
            "Executing agent stream"
        );

        let mut history_contents = vec![];
        
        if !context.is_empty() {
            history_contents.push(Content {
                role: "user".to_string(),
                parts: vec![Part::Text(format!("Active Document Context:\n{}\n\n", context))],
            });
        }
        
        for msg in messages {
            let role = if msg.role == "agent" { "model" } else { "user" };
            history_contents.push(Content {
                role: role.to_string(),
                parts: vec![Part::Text(msg.content.clone())],
            });
        }
        
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
            
            let stream = match crate::gemini::call_gemini_stream(&api_key, &model, &request, base_url.as_deref()) {
                Ok(s) => s,
                Err(e) => {
                    yield Err(e);
                    break;
                }
            };
            
            use futures::stream::StreamExt;
            tokio::pin!(stream);
            let mut full_text = String::new();
            let mut function_calls = Vec::new();
            
            while let Some(chunk_res) = stream.next().await {
                match chunk_res {
                    Ok(resp) => {
                        if let Some(mut candidates) = resp.candidates {
                            if let Some(candidate) = candidates.pop() {
                                if let Some(mut content) = candidate.content {
                                    if let Some(parts) = content.parts.take() {
                                        for part in parts {
                                            if let Some(text) = part.text {
                                                full_text.push_str(&text);
                                                yield Ok(text.clone());
                                            } else if let Some(fc) = part.function_call {
                                                function_calls.push(fc);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        yield Err(e);
                        return;
                    }
                }
            }
            
            let mut model_parts = Vec::new();
            if !full_text.is_empty() {
                model_parts.push(Part::Text(full_text));
            }
            for fc in &function_calls {
                model_parts.push(Part::FunctionCall(fc.clone()));
            }
            
            history_contents.push(Content {
                role: "model".to_string(),
                parts: model_parts,
            });
            
            if function_calls.is_empty() {
                break;
            }
            
            let mut function_response_parts = Vec::new();
            for fc in function_calls {
                yield Ok(format!("\n\n*Running tool {}...*\n\n", fc.name));
                
                let result_val = if let Some(executors) = &tool_executors {
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
            
            history_contents.push(Content {
                role: "user".to_string(),
                parts: function_response_parts,
            });
        }
    }
}

pub async fn invoke_agent_stream(
    agent: Agent,
    messages: Vec<ChatMessage>,
    context: String,
    vault_path: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<impl futures::stream::Stream<Item = Result<String, String>>, String> {
    let (api_key, model, executors, final_agent) = prepare_agent_execution(&agent, vault_path.clone(), app_handle).await?;
    
    let augmented_context = if let Some(ref vp) = vault_path {
        format!("Vault Absolute Path: {}\n{}", vp, context)
    } else {
        context
    };

    Ok(execute_agent_stream(
        final_agent,
        api_key,
        model,
        messages,
        augmented_context,
        None,
        Some(std::sync::Arc::new(executors))
    ))
}

#[cfg(test)]
mod tests;
