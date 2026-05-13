use async_trait::async_trait;
use serde_json::Value;
use std::fs;

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    /// Returns the name of the tool
    fn name(&self) -> &str;
    
    /// Executes the tool with the given arguments and returns a JSON response
    async fn execute(&self, args: Value) -> Result<Value, String>;
}

pub struct ReadFileTool {
    pub vault_path: String,
}

#[async_trait]
impl ToolExecutor for ReadFileTool {
    fn name(&self) -> &str {
        "read_file"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'path' argument".to_string())?;

        // Basic security check to prevent directory traversal
        if path.contains("..") {
            return Err("Invalid path".to_string());
        }

        let full_path = std::path::Path::new(&self.vault_path).join(path);
        
        match fs::read_to_string(&full_path) {
            Ok(content) => Ok(serde_json::json!({
                "content": content
            })),
            Err(e) => Err(format!("Failed to read file: {}", e)),
        }
    }
}

