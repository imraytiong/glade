use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::Deserialize;
use std::path::Path;

use super::client::McpClient;
use crate::mcp::types::McpTool;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

#[derive(Deserialize, Debug)]
pub struct McpServerConfig {
    pub command: String,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
}

pub struct McpManager {
    clients: RwLock<HashMap<String, Arc<McpClient>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
        }
    }

    /// Reloads the MCP servers from the configuration file.
    /// Kills existing clients and spawns new ones.
    pub async fn reload(&self, vault_path: &str) -> Result<(), String> {
        let config_path = Path::new(vault_path).join(".glade").join("mcp_servers.json");
        
        let mut new_clients = HashMap::new();
        
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read MCP config: {}", e))?;
                
            let config: McpConfig = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse MCP config: {}", e))?;
                
            for (name, server_config) in config.mcp_servers {
                let args = server_config.args.unwrap_or_default();
                let env = server_config.env.unwrap_or_default();
                
                tracing::info!("Starting MCP server '{}': {} {:?}", name, server_config.command, args);
                
                match McpClient::spawn(&server_config.command, &args, &env, None).await {
                    Ok(client) => {
                        new_clients.insert(name, Arc::new(client));
                    }
                    Err(e) => {
                        tracing::error!("Failed to spawn MCP server '{}': {}", name, e);
                    }
                }
            }
        }
        
        // Swap out the old clients
        let mut clients_write = self.clients.write().await;
        *clients_write = new_clients;
        
        Ok(())
    }

    pub async fn get_client(&self, name: &str) -> Option<Arc<McpClient>> {
        let clients = self.clients.read().await;
        clients.get(name).cloned()
    }

    /// Fetches all tools from all currently active MCP servers.
    /// Returns a map of ServerName::ToolName to the tool definition and the server name.
    pub async fn list_all_tools(&self) -> Result<HashMap<String, (String, McpTool)>, String> {
        let clients = self.clients.read().await;
        let mut all_tools = HashMap::new();
        
        for (server_name, client) in clients.iter() {
            match client.list_tools().await {
                Ok(res) => {
                    for tool in res.tools {
                        // Create a composite name to avoid collisions. Use underscore instead of colon for Gemini API compatibility.
                        let composite_name = format!("{}_{}", server_name, tool.name);
                        all_tools.insert(composite_name, (server_name.clone(), tool));
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to list tools for MCP server '{}': {}", server_name, e);
                }
            }
        }
        
        Ok(all_tools)
    }
}
