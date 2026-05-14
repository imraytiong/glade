use axum::{
    extract::{State, Json},
    routing::{get, post},
    Router,
    response::sse::{Event, Sse, KeepAlive},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tauri::{AppHandle, Manager};

use crate::agent::{self, Agent, ChatMessage};

#[derive(Clone)]
pub struct AppState {
    pub app_handle: AppHandle,
}

pub async fn start_server(app_handle: AppHandle, port: u16) {
    let state = AppState { app_handle };
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/health", get(|| async { "OK" }))
        .route("/api/list_md_files", post(list_md_files_handler))
        .route("/api/get_agents", post(get_agents_handler))
        .route("/api/save_agent", post(save_agent_handler))
        .route("/api/delete_agent", post(delete_agent_handler))
        .route("/api/invoke_agent", post(invoke_agent_handler))
        .route("/api/invoke_agent_stream", post(invoke_agent_stream_handler))
        .route("/api/get_available_tools", post(get_available_tools_handler))
        .route("/api/get_available_skills", post(get_available_skills_handler))
        .route("/api/reload_mcp_servers", post(reload_mcp_servers_handler))
        .route("/api/fs_read_dir", post(fs_read_dir_handler))
        .route("/api/fs_read_text_file", post(fs_read_text_file_handler))
        .route("/api/fs_write_text_file", post(fs_write_text_file_handler))
        .route("/api/fs_exists", post(fs_exists_handler))
        .route("/api/fs_rename", post(fs_rename_handler))
        .route("/api/fs_remove", post(fs_remove_handler))
        .route("/api/fs_mkdir", post(fs_mkdir_handler))
        .route("/api/fs_copy_file", post(fs_copy_file_handler))
        .route("/api/store_get", post(store_get_handler))
        .route("/api/store_set", post(store_set_handler))
        .route("/api/store_save", post(store_save_handler))
        .layer(cors)
        .with_state(Arc::new(state));

    let addr = format!("0.0.0.0:{}", port);
    println!("Headless Server running on http://{}", addr);
    
    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetAgentsReq {
    pub vault_path: String,
}

async fn get_agents_handler(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<GetAgentsReq>,
) -> Result<Json<Vec<Agent>>, String> {
    match agent::get_agents(payload.vault_path).await {
        Ok(agents) => Ok(Json(agents)),
        Err(e) => Err(e),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeAgentReq {
    pub agent: Agent,
    pub messages: Vec<ChatMessage>,
    pub context: String,
    pub vault_path: Option<String>,
}

async fn invoke_agent_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InvokeAgentReq>,
) -> Result<String, String> {
    agent::invoke_agent(
        payload.agent,
        payload.messages,
        payload.context,
        payload.vault_path,
        state.app_handle.clone()
    ).await
}

async fn invoke_agent_stream_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InvokeAgentReq>,
) -> Result<Sse<impl futures::stream::Stream<Item = Result<Event, std::convert::Infallible>>>, String> {
    use futures::stream::StreamExt;
    let stream = agent::invoke_agent_stream(
        payload.agent,
        payload.messages,
        payload.context,
        payload.vault_path,
        state.app_handle.clone()
    ).await?;

    let sse_stream = stream.map(|res| {
        match res {
            Ok(data) => Ok::<_, std::convert::Infallible>(Event::default().data(data)),
            Err(e) => Ok::<_, std::convert::Infallible>(Event::default().event("error").data(e)),
        }
    });

    Ok(Sse::new(sse_stream).keep_alive(KeepAlive::new()))
}

async fn get_available_tools_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<agent::ToolInfo>>, String> {
    match agent::get_available_tools(state.app_handle.clone()).await {
        Ok(tools) => Ok(Json(tools)),
        Err(e) => Err(e),
    }
}

#[derive(Deserialize)]
pub struct ListMdFilesReq {
    pub dir: String,
}

async fn list_md_files_handler(
    Json(payload): Json<ListMdFilesReq>,
) -> Result<Json<Vec<String>>, String> {
    match crate::list_md_files_inner(&payload.dir) {
        Ok(files) => Ok(Json(files)),
        Err(e) => Err(e),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAgentReq {
    pub vault_path: String,
    pub agent: Agent,
}

async fn save_agent_handler(
    Json(payload): Json<SaveAgentReq>,
) -> Result<(), String> {
    agent::save_agent(payload.vault_path, payload.agent).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAgentReq {
    pub vault_path: String,
    pub agent_id: String,
}

async fn delete_agent_handler(
    Json(payload): Json<DeleteAgentReq>,
) -> Result<(), String> {
    agent::delete_agent(payload.vault_path, payload.agent_id).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSkillsReq {
    pub vault_path: String,
}

async fn get_available_skills_handler(
    Json(payload): Json<GetSkillsReq>,
) -> Result<Json<Vec<agent::SkillInfo>>, String> {
    match agent::get_available_skills(payload.vault_path).await {
        Ok(skills) => Ok(Json(skills)),
        Err(e) => Err(e),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReloadMcpReq {
    pub vault_path: String,
}

async fn reload_mcp_servers_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ReloadMcpReq>,
) -> Result<(), String> {
    let mcp_manager = state.app_handle.state::<crate::mcp::McpManager>();
    crate::reload_mcp_servers_inner(payload.vault_path, &mcp_manager).await
}

// --- FILESYSTEM WRAPPERS ---

#[derive(Deserialize)]
pub struct FsReadDirReq {
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsDirEntry {
    pub name: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "isFile")]
    pub is_file: bool,
    #[serde(rename = "isSymlink")]
    pub is_symlink: bool,
}

async fn fs_read_dir_handler(
    Json(payload): Json<FsReadDirReq>,
) -> Result<Json<Vec<FsDirEntry>>, String> {
    let mut entries = Vec::new();
    let dir = std::fs::read_dir(&payload.path).map_err(|e| e.to_string())?;
    for entry in dir {
        if let Ok(entry) = entry {
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            entries.push(FsDirEntry {
                name: entry.file_name().into_string().ok(),
                is_directory: file_type.is_dir(),
                is_file: file_type.is_file(),
                is_symlink: file_type.is_symlink(),
            });
        }
    }
    Ok(Json(entries))
}

#[derive(Deserialize)]
pub struct FsReadTextFileReq {
    pub path: String,
}
async fn fs_read_text_file_handler(
    Json(payload): Json<FsReadTextFileReq>,
) -> Result<String, String> {
    std::fs::read_to_string(&payload.path).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct FsWriteTextFileReq {
    pub path: String,
    pub contents: String,
}
async fn fs_write_text_file_handler(
    Json(payload): Json<FsWriteTextFileReq>,
) -> Result<(), String> {
    std::fs::write(&payload.path, payload.contents).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct FsExistsReq {
    pub path: String,
}
async fn fs_exists_handler(
    Json(payload): Json<FsExistsReq>,
) -> Result<Json<bool>, String> {
    Ok(Json(std::path::Path::new(&payload.path).exists()))
}

#[derive(Deserialize)]
pub struct FsRenameReq {
    #[serde(rename = "oldPath")]
    pub old_path: String,
    #[serde(rename = "newPath")]
    pub new_path: String,
}
async fn fs_rename_handler(
    Json(payload): Json<FsRenameReq>,
) -> Result<(), String> {
    std::fs::rename(&payload.old_path, &payload.new_path).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct FsRemoveReq {
    pub path: String,
}
async fn fs_remove_handler(
    Json(payload): Json<FsRemoveReq>,
) -> Result<(), String> {
    let path = std::path::Path::new(&payload.path);
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[derive(Deserialize)]
pub struct FsMkdirReq {
    pub path: String,
}
async fn fs_mkdir_handler(
    Json(payload): Json<FsMkdirReq>,
) -> Result<(), String> {
    std::fs::create_dir_all(&payload.path).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct FsCopyFileReq {
    pub source: String,
    pub destination: String,
}
async fn fs_copy_file_handler(
    Json(payload): Json<FsCopyFileReq>,
) -> Result<(), String> {
    std::fs::copy(&payload.source, &payload.destination).map_err(|e| e.to_string()).map(|_| ())
}

// --- STORE WRAPPERS ---

use tauri_plugin_store::StoreExt;

#[derive(Deserialize)]
pub struct StoreGetReq {
    pub path: String,
    pub key: String,
}
async fn store_get_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StoreGetReq>,
) -> Result<Json<Option<serde_json::Value>>, String> {
    let store = state.app_handle.store(&payload.path).map_err(|e| e.to_string())?;
    Ok(Json(store.get(&payload.key).clone()))
}

#[derive(Deserialize)]
pub struct StoreSetReq {
    pub path: String,
    pub key: String,
    pub value: serde_json::Value,
}
async fn store_set_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StoreSetReq>,
) -> Result<(), String> {
    let store = state.app_handle.store(&payload.path).map_err(|e| e.to_string())?;
    store.set(&payload.key, payload.value);
    Ok(())
}

#[derive(Deserialize)]
pub struct StoreSaveReq {
    pub path: String,
}
async fn store_save_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StoreSaveReq>,
) -> Result<(), String> {
    let store = state.app_handle.store(&payload.path).map_err(|e| e.to_string())?;
    store.save().map_err(|e| e.to_string())
}
