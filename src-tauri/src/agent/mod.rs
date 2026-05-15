pub mod tools;
pub mod mcp_tool;

use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use tauri::Manager;
use crate::gemini::{self, GeminiRequest, Content, Part, SystemInstruction, FunctionResponse};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TraceEvent {
    StepStarted,
    ToolRequested { name: String, args: serde_json::Value },
    ToolResult { name: String, result: serde_json::Value },
    Error { message: String },
    Completed,
    ApprovalRequired { id: String, tool_name: String, args: serde_json::Value },
    TextGenerated { text: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_requiring_approval: Option<Vec<String>>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentFrontmatter {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_allowed: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills_allowed: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_internal_knowledge_fallback: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_requiring_approval: Option<Vec<String>>,
}

pub struct AgentRegistry;

impl AgentRegistry {
    pub fn get_default_agents() -> Vec<Agent> {
        vec![
            Agent {
                id: "coordinator".to_string(),
                name: "Coordinator".to_string(),
                description: Some("The core Glade IDE assistant for general tasks and coordination.".to_string()),
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
                tools_requiring_approval: None,
            },
            Agent {
                id: "refactor".to_string(),
                name: "Refactor".to_string(),
                description: Some("Specialized agent for rewriting and refactoring text.".to_string()),
                system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.".to_string(),
                model_class: Some("fast".to_string()),
                tools: None,
                tools_allowed: None,
                skills_allowed: None,
                allow_internal_knowledge_fallback: Some(true),
                tools_requiring_approval: None,
            },
        ]
    }
}

pub fn parse_agent_markdown(id: String, content: &str) -> Result<Agent, String> {
    if !content.trim_start().starts_with("---") {
        return Err("Markdown must start with ---".to_string());
    }
    
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return Err("Invalid frontmatter format".to_string());
    }
    
    let frontmatter_str = parts[1];
    let body = parts[2].trim().to_string();
    
    let frontmatter: AgentFrontmatter = serde_yaml::from_str(frontmatter_str)
        .map_err(|e| format!("Failed to parse YAML frontmatter: {}", e))?;
        
    Ok(Agent {
        id,
        name: frontmatter.name,
        description: frontmatter.description,
        system_prompt: body,
        model_class: frontmatter.model_class,
        tools: None,
        tools_allowed: frontmatter.tools_allowed,
        skills_allowed: frontmatter.skills_allowed,
        allow_internal_knowledge_fallback: frontmatter.allow_internal_knowledge_fallback,
        tools_requiring_approval: frontmatter.tools_requiring_approval,
    })
}

fn write_agent_markdown(agent: &Agent) -> Result<String, String> {
    let frontmatter = AgentFrontmatter {
        name: agent.name.clone(),
        description: agent.description.clone(),
        model_class: agent.model_class.clone(),
        tools_allowed: agent.tools_allowed.clone(),
        skills_allowed: agent.skills_allowed.clone(),
        allow_internal_knowledge_fallback: agent.allow_internal_knowledge_fallback,
        tools_requiring_approval: agent.tools_requiring_approval.clone(),
    };
    
    let yaml = serde_yaml::to_string(&frontmatter)
        .map_err(|e| format!("Failed to serialize YAML frontmatter: {}", e))?;
        
    Ok(format!("---\n{}---\n\n{}", yaml.trim(), agent.system_prompt.trim()))
}

#[tauri::command]
pub async fn get_agents(vault_path: String) -> Result<Vec<Agent>, String> {
    let glade_dir = std::path::Path::new(&vault_path).join(".glade");
    let agents_dir = glade_dir.join("agents");
    let default_skill_dir = glade_dir.join(".agents").join("skills").join("Research a Topic");
    
    // Ensure the default skill directory exists
    if !default_skill_dir.exists() {
        if let Ok(_) = std::fs::create_dir_all(&default_skill_dir) {
            let skill_md_path = default_skill_dir.join("SKILL.md");
            let default_skill_content = "# Research a Topic\n\nThis skill enables the agent to autonomously research a topic using search tools and synthesize the findings.";
            let _ = std::fs::write(&skill_md_path, default_skill_content);
        }
    }

    if !agents_dir.exists() {
        let _ = std::fs::create_dir_all(&agents_dir);
        let defaults = AgentRegistry::get_default_agents();
        for agent in &defaults {
            if let Ok(md_content) = write_agent_markdown(agent) {
                let file_path = agents_dir.join(format!("{}.agent.md", agent.id));
                let _ = std::fs::write(&file_path, md_content);
            }
        }
        return Ok(defaults);
    }
    
    let mut agents = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&agents_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if file_name.ends_with(".agent.md") {
                    let id = file_name.trim_end_matches(".agent.md").to_string();
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        match parse_agent_markdown(id, &content) {
                            Ok(agent) => agents.push(agent),
                            Err(e) => eprintln!("Failed to parse agent {}: {}", file_name, e),
                        }
                    }
                }
            }
        }
    }
    
    // Fallback if none could be read
    if agents.is_empty() {
        return Ok(AgentRegistry::get_default_agents());
    }
    
    // Sort agents by name
    agents.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(agents)
}

#[tauri::command]
pub async fn save_agent(vault_path: String, agent: Agent) -> Result<(), String> {
    let agents_dir = std::path::Path::new(&vault_path).join(".glade").join("agents");
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir).map_err(|e| format!("Failed to create agents directory: {}", e))?;
    }
    
    let md_content = write_agent_markdown(&agent)?;
    let file_path = agents_dir.join(format!("{}.agent.md", agent.id));
    
    std::fs::write(&file_path, md_content).map_err(|e| format!("Failed to write agent file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_agent(vault_path: String, agent_id: String) -> Result<(), String> {
    let agents_dir = std::path::Path::new(&vault_path).join(".glade").join("agents");
    let file_path = agents_dir.join(format!("{}.agent.md", agent_id));
    
    if file_path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete agent file: {}", e))?;
    }
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
    tracing_tx: Option<tokio::sync::mpsc::UnboundedSender<TraceEvent>>,
    pending_approvals: Option<std::sync::Arc<tokio::sync::Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>>,
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
            
            if let Some(ref tx) = tracing_tx {
                let _ = tx.send(TraceEvent::ToolRequested { name: fc.name.clone(), args: fc.args.clone() });
            }

            let requires_approval = match fc.name.as_str() {
                "run_command" | "write_file" => true,
                _ => false,
            };

            let mut approved = true;
            if requires_approval {
                if let Some(ref pending) = pending_approvals {
                    let id = uuid::Uuid::new_v4().to_string();
                    let (otx, orx) = tokio::sync::oneshot::channel();
                    pending.lock().await.insert(id.clone(), otx);
                    
                    if let Some(ref tx) = tracing_tx {
                        let _ = tx.send(TraceEvent::ApprovalRequired { 
                            id: id.clone(), 
                            tool_name: fc.name.clone(), 
                            args: fc.args.clone() 
                        });
                    }
                    approved = orx.await.unwrap_or(false);
                }
            }

            let result_val = if !approved {
                serde_json::json!({"error": "User denied execution of this tool."})
            } else if let Some(executors) = tool_executors {
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
            
            if let Some(ref tx) = tracing_tx {
                let _ = tx.send(TraceEvent::ToolResult { name: fc.name.clone(), result: result_val.clone() });
            }

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
    let (api_key, model, executors, final_agent) = prepare_agent_execution(&agent, vault_path.clone(), app_handle.clone()).await?;
    
    let augmented_context = if let Some(ref vp) = vault_path {
        format!("Vault Absolute Path: {}\n{}", vp, context)
    } else {
        context
    };

    let pending_approvals = app_handle.try_state::<crate::PendingApprovalsState>().map(|s| s.inner().inner().clone());

    let (tracing_tx, mut tracing_rx) = tokio::sync::mpsc::unbounded_channel();
    
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        use tauri::Emitter;
        while let Some(event) = tracing_rx.recv().await {
            let _ = app_handle_clone.emit("glade://agent-trace", event);
        }
    });

    execute_agent(&final_agent, &api_key, &model, &messages, &augmented_context, None, Some(&executors), Some(tracing_tx), pending_approvals).await
}

pub fn execute_agent_stream(
    agent: Agent,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    context: String,
    base_url: Option<String>,
    tool_executors: Option<std::sync::Arc<HashMap<String, Box<dyn tools::ToolExecutor>>>>,
    tracing_tx: Option<tokio::sync::mpsc::UnboundedSender<TraceEvent>>,
    pending_approvals: Option<std::sync::Arc<tokio::sync::Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>>,
) -> impl futures::stream::Stream<Item = Result<String, String>> {
    async_stream::stream! {
        tracing::info!(
            target: "agent_execution",
            agent_id = %agent.id,
            model = %model,
            "Executing agent stream"
        );
        if let Some(ref tx) = tracing_tx {
            let _ = tx.send(TraceEvent::StepStarted);
        }

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
                                                if let Some(ref tx) = tracing_tx {
                                                    let _ = tx.send(TraceEvent::TextGenerated { text: text.clone() });
                                                }
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
                
                if let Some(ref tx) = tracing_tx {
                    let _ = tx.send(TraceEvent::ToolRequested { name: fc.name.clone(), args: fc.args.clone() });
                }

                // Check for autonomous approval
                let mut requires_approval = match fc.name.as_str() {
                    "run_command" | "write_file" => true,
                    _ => false,
                };

                let require_approval_override = agent.tools_requiring_approval.as_ref().map_or(false, |reqs| reqs.contains(&fc.name));

                if requires_approval {
                    let explicitly_allowed = agent.tools_allowed.as_ref().map_or(false, |tools| tools.contains(&fc.name));
                    
                    if explicitly_allowed && !require_approval_override {
                        requires_approval = false;
                    }
                } else if require_approval_override {
                    requires_approval = true;
                }

                let mut approved = true;
                if requires_approval {
                    if let Some(ref pending) = pending_approvals {
                        let id = uuid::Uuid::new_v4().to_string();
                        let (otx, orx) = tokio::sync::oneshot::channel();
                        pending.lock().await.insert(id.clone(), otx);
                        
                        if let Some(ref tx) = tracing_tx {
                            let _ = tx.send(TraceEvent::ApprovalRequired { 
                                id: id.clone(), 
                                tool_name: fc.name.clone(), 
                                args: fc.args.clone() 
                            });
                        }
                        
                        yield Ok(format!("\n\n*Waiting for approval to run {}...*\n\n", fc.name));
                        approved = orx.await.unwrap_or(false);
                    }
                }

                let result_val = if !approved {
                    serde_json::json!({"error": "User denied execution of this tool."})
                } else if let Some(executors) = &tool_executors {
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
                
                if let Some(ref tx) = tracing_tx {
                    let _ = tx.send(TraceEvent::ToolResult { name: fc.name.clone(), result: result_val.clone() });
                }
                
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
        if let Some(ref tx) = tracing_tx {
            let _ = tx.send(TraceEvent::Completed);
        }
    }
}

pub async fn generate_agent_persona_inner(
    prompt: &str,
    _vault_path: &str,
    api_key: &str,
    model: &str,
) -> Result<Agent, String> {
    let system_instruction = gemini::SystemInstruction {
        parts: vec![gemini::Part::Text(
            "You are an expert AI persona architect. The user will describe an agent they want to build. You must output a JSON object representing this agent's configuration. The JSON MUST conform exactly to the following structure and be raw JSON (no markdown block formatting, no backticks).
            {
                \"id\": \"short_unique_id\",
                \"name\": \"Human Readable Name\",
                \"system_prompt\": \"The detailed instructions and persona for the agent. Make it highly capable and explicit.\",
                \"model_class\": \"reasoning\" or \"large\" or \"fast\",
                \"tools_allowed\": [\"read_file\", \"write_file\", \"list_directory\", \"search_files\", \"run_command\"],
                \"skills_allowed\": [],
                \"allow_internal_knowledge_fallback\": true,
                \"tools_requiring_approval\": [\"write_file\", \"run_command\"]
            }".to_string()
        )],
    };

    let request = gemini::GeminiRequest {
        contents: vec![gemini::Content {
            role: "user".to_string(),
            parts: vec![gemini::Part::Text(prompt.to_string())],
        }],
        system_instruction: Some(system_instruction),
        tools: None,
    };

    let response = gemini::call_gemini(api_key, model, &request, None).await.map_err(|e| e.to_string())?;

    let output_text = response.candidates
        .and_then(|mut c| c.pop())
        .and_then(|c| c.content)
        .and_then(|mut content| content.parts.take())
        .and_then(|mut parts| parts.pop())
        .and_then(|p| p.text)
        .unwrap_or_default();

    let cleaned_text = output_text.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let new_agent: Agent = serde_json::from_str(cleaned_text).map_err(|e| format!("Failed to parse JSON agent: {}", e))?;

    Ok(new_agent)
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
        Some(std::sync::Arc::new(executors)),
        None,
        None
    ))
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_and_write_agent() {
        let agent = Agent {
            id: "test".to_string(),
            name: "Test Agent".to_string(),
            description: Some("desc".to_string()),
            system_prompt: "body".to_string(),
            model_class: Some("fast".to_string()),
            tools: None,
            tools_allowed: Some(vec!["tool1".to_string(), "tool2".to_string()]),
            skills_allowed: Some(vec![]),
            allow_internal_knowledge_fallback: Some(true),
            tools_requiring_approval: None,
        };

        let md = write_agent_markdown(&agent).unwrap();
        println!("MD:\n{}", md);

        let parsed = parse_agent_markdown("test".to_string(), &md).unwrap();
        println!("PARSED: {:?}", parsed);
    }
}
