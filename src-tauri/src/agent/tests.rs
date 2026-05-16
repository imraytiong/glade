use super::*;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};
use serde_json::json;
use std::env;

async fn setup_tracing() {
    let _ = tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();
}

// ==========================================
// LEVEL 1: MOCKED SERVICE TESTING
// ==========================================

#[tokio::test]
async fn test_mock_coordinator_routing_success() {
    setup_tracing().await;
    
    let mock_server = MockServer::start().await;
    let base_url = mock_server.uri();
    
    let response_body = json!({
        "candidates": [{
            "content": {
                "parts": [{ "text": "This is a mocked response citing context." }]
            }
        }]
    });
    
    Mock::given(method("POST"))
        .and(path("/v1beta/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;
        
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        "dummy_key",
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "What does the document say?".into() }],
        "This document is about testing.",
        Some(&base_url),
        None,
        None,
        None
    ).await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "This is a mocked response citing context.");
}

#[tokio::test]
async fn test_mock_401_unauthorized() {
    setup_tracing().await;
    let mock_server = MockServer::start().await;
    let base_url = mock_server.uri();
    
    Mock::given(method("POST"))
        .and(path("/v1beta/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(401).set_body_string("API key not valid."))
        .mount(&mock_server)
        .await;
        
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        "invalid_key",
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "Query".into() }],
        "",
        Some(&base_url),
        None,
        None,
        None
    ).await;
    
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("401 Unauthorized"));
}

#[tokio::test]
async fn test_mock_503_service_unavailable() {
    setup_tracing().await;
    let mock_server = MockServer::start().await;
    let base_url = mock_server.uri();
    
    Mock::given(method("POST"))
        .and(path("/v1beta/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(503).set_body_string("Service overloaded."))
        .mount(&mock_server)
        .await;
        
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        "dummy_key",
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "Query".into() }],
        "",
        Some(&base_url),
        None,
        None,
        None
    ).await;
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("503 Service Unavailable"));
}

#[tokio::test]
async fn test_mock_malformed_json_response() {
    setup_tracing().await;
    let mock_server = MockServer::start().await;
    let base_url = mock_server.uri();
    
    Mock::given(method("POST"))
        .and(path("/v1beta/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(200).set_body_string("{ invalid json "))
        .mount(&mock_server)
        .await;
        
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        "dummy_key",
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "Query".into() }],
        "",
        Some(&base_url),
        None,
        None,
        None
    ).await;
    
    assert!(result.is_err()); // JSON parsing should fail
}

#[tokio::test]
async fn test_mock_empty_llm_response() {
    setup_tracing().await;
    let mock_server = MockServer::start().await;
    let base_url = mock_server.uri();
    
    // Valid JSON but missing candidates
    let response_body = json!({});
    
    Mock::given(method("POST"))
        .and(path("/v1beta/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;
        
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        "dummy_key",
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "Query".into() }],
        "",
        Some(&base_url),
        None,
        None,
        None
    ).await;
    
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), "No response candidate generated.");
}

// ==========================================
// LEVEL 2: REAL LLM BACKED E2E TESTING
// ==========================================

#[tokio::test]
async fn test_live_coordinator_routing() {
    setup_tracing().await;
    if env::var("RUN_LIVE_LLM_TESTS").unwrap_or_default() != "1" {
        println!("Skipping live test: RUN_LIVE_LLM_TESTS != 1");
        return;
    }
    
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set for live tests");
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "coordinator").unwrap();
    
    let result = execute_agent(
        agent,
        &api_key,
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "What is the secret word in the document?".into() }],
        "The secret word is 'Antigravity'.",
        None,
        None,
        None,
        None
    ).await;
    
    assert!(result.is_ok());
    let text = result.unwrap();
    assert!(text.contains("Antigravity"), "Model failed to cite the injected context. Output: {}", text);
}

#[tokio::test]
async fn test_live_refactor_formatting() {
    setup_tracing().await;
    if env::var("RUN_LIVE_LLM_TESTS").unwrap_or_default() != "1" {
        println!("Skipping live test: RUN_LIVE_LLM_TESTS != 1");
        return;
    }
    
    let api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set for live tests");
    let defaults = AgentRegistry::get_default_agents();
    let agent = &defaults.into_iter().find(|a| a.id == "refactor").unwrap();
    
    let result = execute_agent(
        agent,
        &api_key,
        "gemini-1.5-flash",
        &[ChatMessage { role: "user".into(), content: "Make this a bulleted list: apple, banana, cherry".into() }],
        "",
        None,
        None,
        None,
        None
    ).await;
    
    assert!(result.is_ok());
    let text = result.unwrap();
    // Verify it contains markdown bullets and no conversational filler
    assert!(text.contains("- apple") || text.contains("* apple"));
    assert!(text.contains("banana"));
    assert!(!text.to_lowercase().contains("here is the"));
}

#[test]
fn test_parse_agent_markdown_valid() {
    let md = r#"---
name: Test Agent
model_class: reasoning
tools_allowed:
  - read_file
---

This is the system prompt.
"#;
    let result = super::parse_agent_markdown("test_id".to_string(), md);
    assert!(result.is_ok());
    let agent = result.unwrap();
    assert_eq!(agent.id, "test_id");
    assert_eq!(agent.name, "Test Agent");
    assert_eq!(agent.system_prompt, "This is the system prompt.");
    assert_eq!(agent.model_class.unwrap(), "reasoning");
    assert_eq!(agent.tools_allowed.unwrap().len(), 1);
}

#[test]
fn test_parse_agent_markdown_missing_frontmatter() {
    let md = "This is just text without frontmatter.";
    let result = super::parse_agent_markdown("test".to_string(), md);
    assert!(result.is_err());
}
