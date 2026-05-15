mod agent;
mod gemini;
pub mod mcp;
pub mod server;
pub mod vector_db;

use walkdir::WalkDir;
use tauri::{Manager, Emitter};
use tauri_plugin_store::StoreExt;

use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use std::collections::HashMap;

pub struct PendingApprovalsState(pub Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>);

impl PendingApprovalsState {
    pub fn inner(&self) -> &Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>> {
        &self.0
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn list_md_files_inner(dir: &str) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    if let Some(path_str) = path.to_str() {
                        files.push(path_str.to_string());
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
fn list_md_files(dir: &str) -> Result<Vec<String>, String> {
    list_md_files_inner(dir)
}

pub async fn reload_mcp_servers_inner(vault_path: String, mcp_manager: &mcp::McpManager) -> Result<(), String> {
    mcp_manager.reload(&vault_path).await?;
    Ok(())
}

#[tauri::command]
async fn reload_mcp_servers(vault_path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mcp_manager = app_handle.state::<mcp::McpManager>();
    reload_mcp_servers_inner(vault_path, &mcp_manager).await
}

#[tauri::command]
async fn open_agent_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("agent-workspace") {
        let _ = window.set_focus();
        return Ok(());
    }

    let result = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "agent-workspace",
        tauri::WebviewUrl::App("/?view=agent".into())
    )
    .title("Glade - Agent Workspace")
    .inner_size(800.0, 600.0)
    .build();

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to spawn window: {}", e)),
    }
}

#[tauri::command]
async fn build_agent(prompt: String, vault_path: String, app_handle: tauri::AppHandle) -> Result<agent::Agent, String> {
    let stores = app_handle.store("settings.json").map_err(|e| format!("Failed to access store: {}", e))?;
    let _ = stores.reload();
    
    let api_key_val = stores.get("gemini_api_key").ok_or("Gemini API Key not set in Settings")?;
    let api_key = api_key_val.as_str().ok_or("Invalid API Key format")?;
    
    // Default to reasoning model, fallback to general if not set
    let model = stores.get("model_reasoning").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-2.5-pro".to_string());
    
    let new_agent = agent::generate_agent_persona_inner(&prompt, &vault_path, api_key, &model).await?;
    
    // Broadcast update event
    let _ = app_handle.emit("glade://vault-updated", ());
    
    Ok(new_agent)
}

#[tauri::command]
async fn build_skill(prompt: String, vault_path: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    let stores = app_handle.store("settings.json").map_err(|e| format!("Failed to access store: {}", e))?;
    let _ = stores.reload();
    
    let api_key_val = stores.get("gemini_api_key").ok_or("Gemini API Key not set in Settings")?;
    let api_key = api_key_val.as_str().ok_or("Invalid API Key format")?;
    
    // Default to reasoning model, fallback to general if not set
    let model = stores.get("model_reasoning").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-2.5-pro".to_string());
    
    let skill_md = agent::generate_skill_inner(&prompt, &vault_path, api_key, &model).await?;
    
    Ok(skill_md)
}

#[tauri::command]
async fn approve_agent_action(id: String, approved: bool, app_handle: tauri::AppHandle) -> Result<(), String> {
    let pending = app_handle.try_state::<PendingApprovalsState>().ok_or("No pending approvals state")?;
    let mut map = pending.0.lock().await;
    if let Some(tx) = map.remove(&id) {
        let _ = tx.send(approved);
        Ok(())
    } else {
        Err("Approval ID not found or already processed".to_string())
    }
}

#[tauri::command]
async fn build_index(vault_path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let manager = app_handle.state::<vector_db::VectorDbManager>();
    let db_arc = manager.get_or_create(&vault_path).await?;
    
    tauri::async_runtime::spawn_blocking(move || {
        let mut db = db_arc.blocking_write();
        db.build_index()
    }).await.map_err(|e| format!("Join error: {}", e))?
}

#[tauri::command]
async fn build_tool(prompt: String, vault_path: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let stores = app_handle.store("settings.json").map_err(|e| format!("Failed to access store: {}", e))?;
    let _ = stores.reload();
    
    let api_key_val = stores.get("gemini_api_key").ok_or("Gemini API Key not set in Settings")?;
    let api_key = api_key_val.as_str().ok_or("Invalid API Key format")?;
    
    // Default to reasoning model, fallback to general if not set
    let model = stores.get("model_reasoning").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "gemini-2.5-pro".to_string());
    
    let tool_json = agent::generate_tool_inner(&prompt, &vault_path, api_key, &model).await?;
    
    Ok(tool_json)
}

#[tauri::command]
async fn ping_mcp_server(command: String, args: Vec<String>, env: std::collections::HashMap<String, String>, app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let spawn_future = mcp::client::McpClient::spawn(&command, &args, &env, Some(app_handle));
    let client = tokio::time::timeout(std::time::Duration::from_secs(30), spawn_future)
        .await
        .map_err(|_| "Timeout waiting for MCP server to start. The server might be downloading dependencies or waiting for user input.")?
        .map_err(|e| e)?;
        
    let tools_future = client.list_tools();
    let tools = tokio::time::timeout(std::time::Duration::from_secs(10), tools_future)
        .await
        .map_err(|_| "Timeout waiting for list_tools response")?
        .map_err(|e| e)?;
    
    Ok(serde_json::json!({
        "tools": tools.tools
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(mcp::McpManager::new())
        .manage(vector_db::VectorDbManager::new())
        .manage(PendingApprovalsState(Arc::new(Mutex::new(HashMap::new()))))
        .setup(|app| {
            let is_headless = std::env::args().any(|arg| arg == "--headless");
            
            if is_headless {
                // In headless mode, we can close the default window (if any)
                // and start the Axum server.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
                
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    server::start_server(app_handle, 1421).await;
                });
            }
            Ok(())
        });
        let is_headless = std::env::args().any(|arg| arg == "--headless");
        let app = builder
            .invoke_handler(tauri::generate_handler![
                greet, 
                list_md_files, 
                agent::invoke_agent, 
                reload_mcp_servers,
                agent::get_agents,
                agent::save_agent,
                agent::delete_agent,
                agent::get_available_tools,
                agent::get_available_skills,
                agent::save_skill,
                agent::delete_skill,
                agent::get_agent_logs,
                open_agent_window,
                build_agent,
                build_skill,
                approve_agent_action,
                build_index,
                build_tool,
                ping_mcp_server,
                agent::load_thread,
                agent::invoke_agent,
                agent::append_message_to_thread,
                agent::clear_thread,
            ])
            .build(tauri::generate_context!())
            .expect("error while running tauri application");

        app.run(move |_app_handle, e| match e {
            tauri::RunEvent::ExitRequested { api, .. } => {
                if is_headless {
                    api.prevent_exit();
                }
            }
            _ => {}
        });
}
