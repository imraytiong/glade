use std::path::{Path, PathBuf};
use std::fs;

/// Resolves the shadow file system directory for a specific agent.
/// This directory is used to store autonomous traces, execution logs, and agent-specific state.
pub fn get_shadow_fs_path(vault_path: &str, agent_id: &str) -> PathBuf {
    Path::new(vault_path)
        .join(".glade")
        .join(".shadow")
        .join("agents")
        .join(agent_id)
}

/// Ensures that the shadow directory exists for an agent.
pub fn ensure_shadow_fs(vault_path: &str, agent_id: &str) -> std::io::Result<PathBuf> {
    let path = get_shadow_fs_path(vault_path, agent_id);
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    Ok(path)
}

/// Appends a log entry to the agent's execution log in its shadow directory.
pub fn append_execution_log(vault_path: &str, agent_id: &str, log_entry: &str) -> std::io::Result<()> {
    use std::io::Write;
    let dir = ensure_shadow_fs(vault_path, agent_id)?;
    let log_file = dir.join("execution.log");
    
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)?;
        
    writeln!(file, "{}", log_entry)?;
    Ok(())
}

/// Retrieves the execution log for an agent.
pub fn read_execution_log(vault_path: &str, agent_id: &str) -> std::io::Result<String> {
    let dir = ensure_shadow_fs(vault_path, agent_id)?;
    let log_file = dir.join("execution.log");
    if log_file.exists() {
        fs::read_to_string(log_file)
    } else {
        Ok(String::new())
    }
}
