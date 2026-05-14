use async_trait::async_trait;
use serde_json::Value;
use std::fs;

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    #[allow(dead_code)]
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

pub struct WriteFileTool {
    pub vault_path: String,
}

#[async_trait]
impl ToolExecutor for WriteFileTool {
    fn name(&self) -> &str {
        "write_file"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'path' argument".to_string())?;

        let content = args.get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'content' argument".to_string())?;

        if path.contains("..") {
            return Err("Invalid path".to_string());
        }

        let full_path = std::path::Path::new(&self.vault_path).join(path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        match fs::write(&full_path, content) {
            Ok(_) => Ok(serde_json::json!({
                "success": true,
                "message": format!("Successfully wrote to {}", path)
            })),
            Err(e) => Err(format!("Failed to write file: {}", e)),
        }
    }
}

pub struct ListDirectoryTool {
    pub vault_path: String,
}

#[async_trait]
impl ToolExecutor for ListDirectoryTool {
    fn name(&self) -> &str {
        "list_directory"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let path = args.get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(""); // Default to root if not provided

        if path.contains("..") {
            return Err("Invalid path".to_string());
        }

        let full_path = std::path::Path::new(&self.vault_path).join(path);
        
        let mut entries = Vec::new();
        match fs::read_dir(&full_path) {
            Ok(dir_entries) => {
                for entry in dir_entries.filter_map(|e| e.ok()) {
                    let file_name = entry.file_name().into_string().unwrap_or_default();
                    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    entries.push(serde_json::json!({
                        "name": file_name,
                        "type": if is_dir { "directory" } else { "file" }
                    }));
                }
                Ok(serde_json::json!({
                    "path": path,
                    "entries": entries
                }))
            },
            Err(e) => Err(format!("Failed to list directory: {}", e)),
        }
    }
}

pub struct SearchFilesTool {
    pub vault_path: String,
}

#[async_trait]
impl ToolExecutor for SearchFilesTool {
    fn name(&self) -> &str {
        "search_files"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let query = args.get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'query' argument".to_string())?;

        let mut matches = Vec::new();
        let walker = walkdir::WalkDir::new(&self.vault_path)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.')); // Ignore hidden dirs like .git, .glade

        for entry in walker.filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }
            
            let file_name = entry.file_name().to_string_lossy();
            let mut matched = file_name.contains(query);
            
            // If filename doesn't match, check content
            if !matched {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if content.contains(query) {
                        matched = true;
                    }
                }
            }
            
            if matched {
                if let Ok(rel_path) = entry.path().strip_prefix(&self.vault_path) {
                    matches.push(rel_path.to_string_lossy().to_string());
                }
            }
            
            // Limit to top 50 matches to prevent massive payloads
            if matches.len() >= 50 {
                break;
            }
        }

        Ok(serde_json::json!({
            "query": query,
            "matches": matches
        }))
    }
}

pub struct RunCommandTool {
    pub vault_path: String,
}

#[async_trait]
impl ToolExecutor for RunCommandTool {
    fn name(&self) -> &str {
        "run_command"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let command_str = args.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'command' argument".to_string())?;

        let args_arr: Vec<String> = args.get("args")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let output = tokio::process::Command::new(command_str)
            .args(args_arr)
            .current_dir(&self.vault_path)
            .output()
            .await
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(serde_json::json!({
            "success": output.status.success(),
            "code": output.status.code(),
            "stdout": stdout,
            "stderr": stderr
        }))
    }
}
