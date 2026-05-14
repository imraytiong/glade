mod agent;
mod gemini;
pub mod mcp;
pub mod server;

use walkdir::WalkDir;
use tauri::Manager;
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
                agent::get_available_skills
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
