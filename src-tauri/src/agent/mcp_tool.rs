use std::sync::Arc;
use async_trait::async_trait;
use serde_json::Value;

use super::tools::ToolExecutor;
use crate::mcp::client::McpClient;

pub struct McpToolExecutor {
    /// The composite name of the tool (ServerName::ToolName)
    composite_name: String,
    /// The actual name of the tool on the server
    original_name: String,
    /// The MCP client to execute the tool
    client: Arc<McpClient>,
}

impl McpToolExecutor {
    pub fn new(composite_name: String, original_name: String, client: Arc<McpClient>) -> Self {
        Self {
            composite_name,
            original_name,
            client,
        }
    }
}

#[async_trait]
impl ToolExecutor for McpToolExecutor {
    fn name(&self) -> &str {
        &self.composite_name
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let result = self.client.call_tool(&self.original_name, args).await?;
        
        // MCP call_tool returns a CallToolResult which contains an array of contents.
        // For simplicity, we just extract the first text content or return the full JSON representation.
        if let Some(true) = result.is_error {
            return Err(format!("MCP Tool Execution Error: {:?}", result.content));
        }
        
        let text_contents: Vec<String> = result.content
            .iter()
            .filter_map(|c| {
                if c.content_type == "text" {
                    c.text.clone()
                } else {
                    None
                }
            })
            .collect();
            
        Ok(serde_json::json!({
            "response": text_contents.join("\n")
        }))
    }
}
