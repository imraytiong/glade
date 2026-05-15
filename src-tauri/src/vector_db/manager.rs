use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::Path;
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use std::time::Duration;

use super::VectorDb;

pub struct VectorDbManager {
    dbs: Arc<RwLock<HashMap<String, Arc<RwLock<VectorDb>>>>>,
}

impl Default for VectorDbManager {
    fn default() -> Self {
        Self::new()
    }
}

impl VectorDbManager {
    pub fn new() -> Self {
        Self {
            dbs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_or_create(&self, vault_path: &str) -> Result<Arc<RwLock<VectorDb>>, String> {
        {
            let dbs = self.dbs.read().await;
            if let Some(db) = dbs.get(vault_path) {
                return Ok(db.clone());
            }
        }

        tracing::info!("Initializing new VectorDb for vault: {}", vault_path);
        let db = VectorDb::new(vault_path)?;
        let arc_db = Arc::new(RwLock::new(db));
        
        let mut dbs = self.dbs.write().await;
        dbs.insert(vault_path.to_string(), arc_db.clone());
        
        // When a new vault is added, start the hybrid sync
        Self::start_hybrid_sync(arc_db.clone(), vault_path.to_string());
        
        Ok(arc_db)
    }

    fn start_hybrid_sync(db: Arc<RwLock<VectorDb>>, vault_path: String) {
        let watcher_db = db.clone();
        let watcher_path = vault_path.clone();
        
        // 1. Filesystem Watcher Task (blocking thread to hold debouncer)
        std::thread::spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel();
            let mut debouncer = match new_debouncer(Duration::from_secs(2), tx) {
                Ok(d) => d,
                Err(e) => {
                    tracing::error!("Failed to create debouncer: {}", e);
                    return;
                }
            };
            
            if let Err(e) = debouncer.watcher().watch(Path::new(&watcher_path), RecursiveMode::Recursive) {
                tracing::error!("Failed to watch vault path: {}", e);
                return;
            }
            
            tracing::info!("Started filesystem watcher for vault: {}", watcher_path);
            
            for res in rx {
                match res {
                    Ok(events) => {
                        let has_md_changes = events.iter().any(|e| {
                            e.path.extension().and_then(|s| s.to_str()) == Some("md")
                        });
                        
                        if has_md_changes {
                            tracing::info!("Detected .md file changes in vault, triggering incremental index.");
                            let db_clone = watcher_db.clone();
                            tauri::async_runtime::spawn(async move {
                                let mut db_lock = db_clone.write().await;
                                if let Err(e) = db_lock.build_index() {
                                    tracing::error!("Failed to build index on file change: {}", e);
                                }
                            });
                        }
                    },
                    Err(e) => tracing::error!("Watch error: {:?}", e),
                }
            }
        });

        // 2. Polling Task (5 minutes)
        let polling_db = db.clone();
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                tracing::info!("Running 5-minute background index sweep for vault: {}", vault_path);
                let mut db_lock = polling_db.write().await;
                if let Err(e) = db_lock.build_index() {
                    tracing::error!("Failed to run background sweep indexing: {}", e);
                }
            }
        });
    }
}
