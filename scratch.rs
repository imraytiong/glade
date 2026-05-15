pub async fn generate_tool_inner(
    prompt: &str,
    _vault_path: &str,
    api_key: &str,
    model: &str,
) -> Result<String, String> {
    let system_instruction = gemini::SystemInstruction {
        parts: vec![gemini::Part::Text(
            "You are an expert AI tool configuration generator. The user will describe an MCP (Model Context Protocol) server they want to use. You must output ONLY a valid JSON object containing the configuration for this MCP server. Do not include markdown codeblocks or any other text.
            
The structure MUST be:
{
  \"command\": \"npx\",
  \"args\": [\"-y\", \"@modelcontextprotocol/server-postgres\"],
  \"env\": {
    \"POSTGRES_URL\": \"postgresql://localhost/mydb\"
  }
}
".to_string()
        )],
    };

    let payload = gemini::GenerateContentRequest {
        contents: vec![gemini::Content {
            role: "user".to_string(),
            parts: vec![gemini::Part::Text(prompt.to_string())],
        }],
        system_instruction: Some(system_instruction),
        generation_config: None,
    };

    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    let status = res.status();
    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Gemini API error: {}", body));
    }

    let response: gemini::GenerateContentResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {}\nBody: {}", e, body))?;

    if let Some(candidate) = response.candidates.get(0) {
        if let Some(part) = candidate.content.parts.get(0) {
            if let gemini::Part::Text(text) = part {
                let mut clean_text = text.trim();
                if clean_text.starts_with("```json") {
                    clean_text = &clean_text[7..];
                } else if clean_text.starts_with("```") {
                    clean_text = &clean_text[3..];
                }
                if clean_text.ends_with("```") {
                    clean_text = &clean_text[..clean_text.len() - 3];
                }
                return Ok(clean_text.trim().to_string());
            }
        }
    }

    Err("No valid response generated".to_string())
}
