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
async fn ping_mcp_server(command: String, args: Vec<String>, env: std::collections::HashMap<String, String>) -> Result<serde_json::Value, String> {
    let client = mcp::client::McpClient::spawn(&command, &args, &env).await?;
    let tools = client.list_tools().await?;
    
    Ok(serde_json::json!({
        "tools": tools.tools
    }))
}
