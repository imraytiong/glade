use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex};
use serde_json::Value;

use super::types::{JsonRpcRequest, JsonRpcResponse, ListToolsResult, CallToolResult};

pub struct McpClient {
    request_tx: mpsc::Sender<ClientMessage>,
    next_id: Arc<AtomicU64>,
    _child: Child,
}

enum ClientMessage {
    Request(JsonRpcRequest, oneshot::Sender<Result<JsonRpcResponse, String>>),
    Notification(Value),
}

impl McpClient {
    pub async fn spawn(command: &str, args: &[String], env: &HashMap<String, String>) -> Result<Self, String> {
        let mut child = Command::new(command)
            .args(args)
            .envs(env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP server: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

        let (request_tx, mut request_rx) = mpsc::channel::<ClientMessage>(32);
        
        let pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<JsonRpcResponse, String>>>>> = Arc::new(Mutex::new(HashMap::new()));
        let pending_requests_clone = pending_requests.clone();

        // Stdin writer task
        let mut stdin = stdin;
        tokio::spawn(async move {
            while let Some(msg) = request_rx.recv().await {
                match msg {
                    ClientMessage::Request(req, tx) => {
                        let id = req.id;
                        pending_requests_clone.lock().await.insert(id, tx);
                        let line = serde_json::to_string(&req).unwrap() + "\n";
                        if let Err(e) = stdin.write_all(line.as_bytes()).await {
                            if let Some(tx) = pending_requests_clone.lock().await.remove(&id) {
                                let _ = tx.send(Err(format!("Failed to write to stdin: {}", e)));
                            }
                        }
                    }
                    ClientMessage::Notification(notif) => {
                        let line = serde_json::to_string(&notif).unwrap() + "\n";
                        let _ = stdin.write_all(line.as_bytes()).await;
                    }
                }
            }
        });

        // Stdout reader task
        let pending_requests_clone = pending_requests.clone();
        let mut reader = BufReader::new(stdout);
        tokio::spawn(async move {
            let mut line = String::new();
            while let Ok(bytes) = reader.read_line(&mut line).await {
                if bytes == 0 {
                    break; // EOF
                }
                
                if let Ok(res) = serde_json::from_str::<JsonRpcResponse>(&line) {
                    if let Some(tx) = pending_requests_clone.lock().await.remove(&res.id) {
                        let _ = tx.send(Ok(res));
                    }
                } else if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(&line) {
                    // Ignore incoming requests from the server for now (server calling client)
                    tracing::debug!("Received unhandled request from MCP server: {:?}", req.method);
                }
                line.clear();
            }
        });

        let client = Self {
            request_tx,
            next_id: Arc::new(AtomicU64::new(1)),
            _child: child,
        };

        // Send initialize request
        client.initialize().await?;

        Ok(client)
    }

    pub async fn send_request(&self, method: &str, params: Option<Value>) -> Result<JsonRpcResponse, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let (tx, rx) = oneshot::channel();
        self.request_tx.send(ClientMessage::Request(req, tx)).await.map_err(|_| "Failed to send request to writer task")?;
        
        rx.await.map_err(|_| "Failed to receive response from reader task".to_string())?
    }

    async fn initialize(&self) -> Result<(), String> {
        let params = serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "Glade",
                "version": "0.0.1"
            }
        });

        let res = self.send_request("initialize", Some(params)).await?;
        if let Some(err) = res.error {
            return Err(format!("MCP Init Error: {}", err.message));
        }

        // Send initialized notification
        let notif = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        
        let _ = self.request_tx.send(ClientMessage::Notification(notif)).await;
        Ok(())
    }

    pub async fn list_tools(&self) -> Result<ListToolsResult, String> {
        let res = self.send_request("tools/list", None).await?;
        if let Some(err) = res.error {
            return Err(format!("MCP ListTools Error: {}", err.message));
        }

        let result = res.result.ok_or("No result in response")?;
        serde_json::from_value(result).map_err(|e| format!("Failed to parse tools/list result: {}", e))
    }

    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<CallToolResult, String> {
        let params = serde_json::json!({
            "name": name,
            "arguments": arguments
        });

        let res = self.send_request("tools/call", Some(params)).await?;
        if let Some(err) = res.error {
            return Err(format!("MCP CallTool Error: {}", err.message));
        }

        let result = res.result.ok_or("No result in response")?;
        serde_json::from_value(result).map_err(|e| format!("Failed to parse tools/call result: {}", e))
    }
}
