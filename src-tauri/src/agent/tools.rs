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
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
}

pub fn is_path_allowed(_vault_path: &str, requested_path: &str, allowed_zones: &Option<Vec<crate::agent::ZoneRule>>, action: &str) -> bool {
    if let Some(zones) = allowed_zones {
        let req_path = requested_path.trim_start_matches('/');
        let req_path_obj = std::path::Path::new(req_path);
        
        let mut sorted_zones = zones.clone();
        sorted_zones.sort_by_key(|z| z.path.len());
        sorted_zones.reverse();

        for zone in &sorted_zones {
            let zone_clean = zone.path.trim_start_matches('/');
            let zone_path = std::path::Path::new(zone_clean);
            if req_path_obj.starts_with(zone_path) {
                match zone.permission.as_str() {
                    "deny" => return false,
                    "write" => return true,
                    "read" | "read_preferred" => return action == "read",
                    "append_only" => return action == "read" || action == "append",
                    _ => return false,
                }
            }
        }
        return false;
    }
    true
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

        if !is_path_allowed(&self.vault_path, path, &self.allowed_zones, "read") {
            return Err(format!("Access denied: Path '{}' is outside allowed zones.", path));
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
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
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

        let is_append = args.get("append").and_then(|v| v.as_bool()).unwrap_or(false);
        let action = if is_append { "append" } else { "write" };

        if !is_path_allowed(&self.vault_path, path, &self.allowed_zones, action) {
            return Err(format!("Access denied: Path '{}' lacks '{}' permission in allowed zones.", path, action));
        }

        let full_path = std::path::Path::new(&self.vault_path).join(path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let write_result = if is_append {
            use std::io::Write;
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&full_path)
                .and_then(|mut f| f.write_all(content.as_bytes()))
        } else {
            fs::write(&full_path, content)
        };

        match write_result {
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
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
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

        if !is_path_allowed(&self.vault_path, path, &self.allowed_zones, "read") {
            return Err(format!("Access denied: Path '{}' is outside allowed zones.", path));
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
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
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
                    let rel_path_str = rel_path.to_string_lossy().to_string();
                    if is_path_allowed(&self.vault_path, &rel_path_str, &self.allowed_zones, "read") {
                        matches.push(rel_path_str);
                    }
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
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
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

        if self.allowed_zones.is_some() {
            return Err("Access denied: run_command is entirely disabled when allowed_zones are set to prevent circumventing path restrictions.".to_string());
        }

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

pub struct AgentLogTool {
    pub vault_path: String,
    pub agent_id: String,
}

#[async_trait]
impl ToolExecutor for AgentLogTool {
    fn name(&self) -> &str {
        "agent_log"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let entry = args.get("entry")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'entry' argument".to_string())?;

        crate::agent::shadow_fs::append_execution_log(&self.vault_path, &self.agent_id, entry)
            .map_err(|e| format!("Failed to write to agent log: {}", e))?;

        Ok(serde_json::json!({
            "success": true,
            "message": "Appended to execution log."
        }))
    }
}

pub struct SemanticSearchTool {
    pub vault_path: String,
    pub allowed_zones: Option<Vec<crate::agent::ZoneRule>>,
    pub db: std::sync::Arc<tokio::sync::RwLock<crate::vector_db::VectorDb>>,
}

#[async_trait]
impl ToolExecutor for SemanticSearchTool {
    fn name(&self) -> &str {
        "semantic_search"
    }

    async fn execute(&self, args: Value) -> Result<Value, String> {
        let query = args.get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing or invalid 'query' argument".to_string())?;

        let limit = args.get("limit")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize)
            .unwrap_or(5);

        // We run the embedding model in a blocking task since it's computationally intensive

        let query_owned = query.to_string();
        
        let db_arc = self.db.clone();
        
        let results = tauri::async_runtime::spawn_blocking(move || {
            let mut db = db_arc.blocking_write();
            db.search(&query_owned, limit)
        }).await.map_err(|e| format!("Join error: {}", e))??;
        
        // Filter out results that aren't in allowed_zones
        let mut filtered_results = Vec::new();
        for res in results {
            if let Some(path) = res.get("file_path").and_then(|v| v.as_str()) {
                if is_path_allowed(&self.vault_path, path, &self.allowed_zones, "read") {
                    filtered_results.push(res);
                }
            }
        }

        Ok(serde_json::json!({
            "query": query,
            "results": filtered_results
        }))
    }
}
