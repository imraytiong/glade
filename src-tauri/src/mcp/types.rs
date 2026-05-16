use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// Basic types for MCP Tools
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ListToolsResult {
    pub tools: Vec<McpTool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CallToolResult {
    pub content: Vec<CallToolResultContent>,
    pub is_error: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CallToolResultContent {
    #[serde(rename = "type")]
    pub content_type: String, // "text" or "image"
    pub text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_jsonrpc_request_serialization() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "test_method".to_string(),
            params: Some(json!({"key": "value"})),
        };
        let serialized = serde_json::to_string(&req).unwrap();
        assert!(serialized.contains(r#""jsonrpc":"2.0""#));
        assert!(serialized.contains(r#""id":1"#));
        assert!(serialized.contains(r#""method":"test_method""#));
        assert!(serialized.contains(r#""params":{"key":"value"}"#));
    }

    #[test]
    fn test_jsonrpc_response_deserialization() {
        let json_str = r#"{
            "jsonrpc": "2.0",
            "id": 1,
            "result": { "status": "ok" }
        }"#;
        let res: JsonRpcResponse = serde_json::from_str(json_str).unwrap();
        assert_eq!(res.jsonrpc, "2.0");
        assert_eq!(res.id, 1);
        assert!(res.result.is_some());
        assert!(res.error.is_none());
    }

    #[test]
    fn test_mcp_tool_deserialization() {
        let json_str = r#"{
            "name": "read_file",
            "description": "Reads a file",
            "inputSchema": { "type": "object" }
        }"#;
        let tool: McpTool = serde_json::from_str(json_str).unwrap();
        assert_eq!(tool.name, "read_file");
        assert_eq!(tool.description.unwrap(), "Reads a file");
        assert!(tool.input_schema.is_object());
    }

    #[test]
    fn test_call_tool_result_deserialization() {
        let json_str = r#"{
            "content": [
                {
                    "type": "text",
                    "text": "File contents here"
                }
            ],
            "isError": false
        }"#;
        let result: CallToolResult = serde_json::from_str(json_str).unwrap();
        assert_eq!(result.content.len(), 1);
        assert_eq!(result.content[0].content_type, "text");
        assert_eq!(result.content[0].text.as_deref().unwrap(), "File contents here");
        assert_eq!(result.is_error, Some(false));
    }
}
