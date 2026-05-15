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

    let request = gemini::GeminiRequest {
        contents: vec![gemini::Content {
            role: "user".to_string(),
            parts: vec![gemini::Part::Text(prompt.to_string())],
        }],
        system_instruction: Some(system_instruction),
        tools: None,
    };

    let response = gemini::call_gemini(api_key, model, &request, None).await.map_err(|e| e.to_string())?;

    let output_text = response.candidates
        .and_then(|mut c| c.pop())
        .and_then(|c| c.content)
        .and_then(|mut content| content.parts.take())
        .and_then(|mut parts| parts.pop())
        .and_then(|p| p.text)
        .unwrap_or_default();

    let cleaned_text = output_text.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    Ok(cleaned_text)
}
