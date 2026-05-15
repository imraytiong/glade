use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use crate::agent::ChatMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEvent {
    pub timestamp: u64,
    pub thread_id: String,
    pub message: ChatMessage,
}

pub struct ThreadManager {
    memory_dir: PathBuf,
}

impl ThreadManager {
    pub fn new(vault_path: &str) -> Self {
        let memory_dir = Path::new(vault_path).join(".glade").join("memory");
        if !memory_dir.exists() {
            let _ = fs::create_dir_all(&memory_dir);
        }
        
        Self { memory_dir }
    }

    fn get_thread_file(&self, thread_id: &str) -> PathBuf {
        self.memory_dir.join(format!("{}.jsonl", thread_id))
    }

    pub fn clear_thread(&self, thread_id: &str) -> Result<(), String> {
        let file_path = self.get_thread_file(thread_id);
        if file_path.exists() {
            std::fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete thread file {}: {}", file_path.display(), e))?;
        }
        Ok(())
    }

    pub fn append_message(&self, thread_id: &str, message: ChatMessage) -> Result<(), String> {
        let event = MemoryEvent {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            thread_id: thread_id.to_string(),
            message,
        };

        let json = serde_json::to_string(&event)
            .map_err(|e| format!("Failed to serialize event: {}", e))?;

        let file_path = self.get_thread_file(thread_id);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| format!("Failed to open thread file {}: {}", file_path.display(), e))?;

        writeln!(file, "{}", json)
            .map_err(|e| format!("Failed to write to thread file: {}", e))?;

        Ok(())
    }

    pub fn load_thread(&self, thread_id: &str) -> Result<Vec<ChatMessage>, String> {
        let file_path = self.get_thread_file(thread_id);
        if !file_path.exists() {
            return Ok(Vec::new());
        }

        let file = fs::File::open(&file_path)
            .map_err(|e| format!("Failed to open thread file: {}", e))?;
        let reader = BufReader::new(file);

        let mut messages = Vec::new();
        for line in reader.lines().flatten() {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<MemoryEvent>(&line) {
                Ok(event) => messages.push(event.message),
                Err(e) => eprintln!("Failed to parse memory event: {}", e),
            }
        }

        Ok(messages)
    }
}
