use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};
use hnsw_rs::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
pub mod manager;
pub use manager::VectorDbManager;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChunkMetadata {
    pub file_path: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub mtime: u64,
}

pub struct VectorDb {
    pub vault_path: String,
    pub model: TextEmbedding,
    pub index: Option<Hnsw<'static, f32, DistDot>>,
    pub metadata: HashMap<usize, ChunkMetadata>,
}

impl VectorDb {
    pub fn new(vault_path: &str) -> Result<Self, String> {
        let model = TextEmbedding::try_new(InitOptions::new(EmbeddingModel::AllMiniLML6V2).with_show_download_progress(true))
        .map_err(|e| format!("Failed to initialize embedding model: {}", e))?;

        let mut db = VectorDb {
            vault_path: vault_path.to_string(),
            model,
            index: None,
            metadata: HashMap::new(),
        };

        let _ = db.load(); // Try to load existing index
        Ok(db)
    }

    fn get_index_path(&self) -> PathBuf {
        Path::new(&self.vault_path).join(".glade").join("vector_db")
    }

    pub fn load(&mut self) -> Result<(), String> {
        let index_dir = self.get_index_path();
        if !index_dir.exists() {
            return Err("Index does not exist".to_string());
        }

        let metadata_path = index_dir.join("metadata.json");
        if metadata_path.exists() {
            let content = fs::read_to_string(&metadata_path)
                .map_err(|e| format!("Failed to read metadata: {}", e))?;
            self.metadata = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse metadata: {}", e))?;
        } else {
            return Err("Metadata does not exist".to_string());
        }

        if !self.metadata.is_empty() {
            let hnsw = Hnsw::<f32, DistDot>::new(16, self.metadata.len(), 16, 200, DistDot {});
            for (id, meta) in &self.metadata {
                hnsw.insert((&meta.embedding, *id));
            }
            self.index = Some(hnsw);
        }

        Ok(())
    }

    pub fn save(&self) -> Result<(), String> {
        let index_dir = self.get_index_path();
        if !index_dir.exists() {
            fs::create_dir_all(&index_dir)
                .map_err(|e| format!("Failed to create index directory: {}", e))?;
                
            // Write sync exclusion files to prevent cloud sync corruption
            let _ = fs::write(index_dir.join(".gitignore"), "*\n");
            let _ = fs::write(index_dir.join(".stignore"), "*\n");
        }

        let metadata_path = index_dir.join("metadata.json");
        let metadata_json = serde_json::to_string(&self.metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(metadata_path, metadata_json)
            .map_err(|e| format!("Failed to write metadata: {}", e))?;

        Ok(())
    }

    pub fn build_index(&mut self) -> Result<(), String> {
        // Collect current files and their mtimes
        let walker = walkdir::WalkDir::new(&self.vault_path)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'));

        let mut current_files: HashMap<String, u64> = HashMap::new();
        for entry in walker.filter_map(|e| e.ok()) {
            if entry.file_type().is_file()
                && entry.path().extension().and_then(|s| s.to_str()) == Some("md") {
                    if let Ok(rel_path) = entry.path().strip_prefix(&self.vault_path) {
                        let path_str = rel_path.to_string_lossy().to_string();
                        if let Ok(metadata) = entry.metadata() {
                            let mtime = metadata.modified().unwrap_or(std::time::UNIX_EPOCH)
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            current_files.insert(path_str, mtime);
                        }
                    }
                }
        }

        let mut next_id = 0;
        let mut new_metadata = HashMap::new();
        let mut unchanged_files = std::collections::HashSet::new();

        // Identify unchanged files
        for meta in self.metadata.values() {
            if let Some(mtime) = current_files.get(&meta.file_path) {
                if *mtime == meta.mtime {
                    unchanged_files.insert(meta.file_path.clone());
                }
            }
        }

        // Transfer unchanged chunks
        for meta in self.metadata.values() {
            if unchanged_files.contains(&meta.file_path) {
                new_metadata.insert(next_id, meta.clone());
                next_id += 1;
            }
        }

        let mut documents = Vec::new();
        let mut pending_metadata = Vec::new();

        // Process changed or new files
        for (path_str, mtime) in &current_files {
            if !unchanged_files.contains(path_str) {
                let abs_path = Path::new(&self.vault_path).join(path_str);
                if let Ok(content) = fs::read_to_string(&abs_path) {
                    let chunks: Vec<&str> = content.split("\n\n").collect();
                    for chunk in chunks {
                        if chunk.trim().is_empty() { continue; }
                        documents.push(chunk.to_string());
                        pending_metadata.push((path_str.clone(), chunk.to_string(), *mtime));
                    }
                }
            }
        }

        // Generate embeddings for new chunks
        if !documents.is_empty() {
            let embeddings = self.model.embed(documents, None)
                .map_err(|e| format!("Failed to generate embeddings: {}", e))?;

            for (i, embedding) in embeddings.into_iter().enumerate() {
                let (file_path, content, mtime) = pending_metadata[i].clone();
                new_metadata.insert(next_id, ChunkMetadata {
                    file_path,
                    content,
                    embedding,
                    mtime,
                });
                next_id += 1;
            }
        }

        if new_metadata.is_empty() {
            return Ok(());
        }

        let hnsw = Hnsw::<f32, DistDot>::new(16, new_metadata.len(), 16, 200, DistDot {});
        for (id, meta) in &new_metadata {
            hnsw.insert((&meta.embedding, *id));
        }

        self.index = Some(hnsw);
        self.metadata = new_metadata;
        self.save()?;

        Ok(())
    }

    pub fn search(&mut self, query: &str, limit: usize) -> Result<Vec<serde_json::Value>, String> {
        let index = self.index.as_ref().ok_or("Index not built".to_string())?;

        let query_embedding = self.model.embed(vec![query.to_string()], None)
            .map_err(|e| format!("Failed to embed query: {}", e))?
            .into_iter()
            .next()
            .unwrap();

        let results = index.search(&query_embedding, limit, 32);
        
        let mut response = Vec::new();
        for neighbor in results {
            if let Some(meta) = self.metadata.get(&neighbor.d_id) {
                response.push(serde_json::json!({
                    "file_path": meta.file_path,
                    "content": meta.content,
                    "score": neighbor.distance
                }));
            }
        }

        Ok(response)
    }
}
