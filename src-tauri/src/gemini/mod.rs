use serde::{Deserialize, Serialize};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeminiRequest {
    pub contents: Vec<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<SystemInstruction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
}

#[derive(Serialize, Clone)]
pub struct Content {
    pub role: String,
    pub parts: Vec<Part>,
}

#[derive(Serialize, Clone)]
pub struct SystemInstruction {
    pub parts: Vec<Part>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Part {
    Text(String),
    FunctionCall(FunctionCall),
    FunctionResponse(FunctionResponse),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub function_declarations: Vec<FunctionDeclaration>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FunctionDeclaration {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Schema>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Schema {
    #[serde(rename = "type")]
    pub schema_type: String, // TYPE_UNSPECIFIED, STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FunctionCall {
    pub name: String,
    pub args: serde_json::Value,
}

#[derive(Serialize, Clone)]
pub struct FunctionResponse {
    pub name: String,
    pub response: serde_json::Value,
}

#[derive(Deserialize, Debug)]
pub struct GeminiResponse {
    pub candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize, Debug)]
pub struct Candidate {
    pub content: Option<CandidateContent>,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct CandidateContent {
    pub parts: Option<Vec<CandidatePart>>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CandidatePart {
    pub text: Option<String>,
    pub function_call: Option<FunctionCall>,
}

pub async fn call_gemini(
    api_key: &str, 
    model: &str,
    request: &GeminiRequest,
    base_url: Option<&str>
) -> Result<GeminiResponse, Box<dyn std::error::Error>> {
    let default_url = "https://generativelanguage.googleapis.com";
    let url_base = base_url.unwrap_or(default_url);
    let url = format!("{}/v1beta/models/{}:generateContent?key={}", url_base, model, api_key);
    
    let client = reqwest::Client::new();
    
    tracing::info!(
        target: "gemini_api",
        url = %url_base,
        request = %serde_json::to_string(request).unwrap_or_default(),
        "Sending request to Gemini"
    );

    let res = client.post(&url)
        .header("Content-Type", "application/json")
        .json(request)
        .send()
        .await?;
        
    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await?;
        tracing::error!(
            target: "gemini_api",
            status = %status,
            error = %err_text,
            "Gemini API returned an error"
        );
        return Err(format!("Gemini API Error ({}): {}", status, err_text).into());
    }
        
    let response: GeminiResponse = res.json().await?;
    
    tracing::info!(
        target: "gemini_api",
        candidates_count = response.candidates.as_ref().map(|c| c.len()).unwrap_or(0),
        "Received successful response from Gemini"
    );

    Ok(response)
}

pub fn call_gemini_stream(
    api_key: &str, 
    model: &str,
    request: &GeminiRequest,
    base_url: Option<&str>
) -> Result<impl futures::stream::Stream<Item = Result<GeminiResponse, String>>, String> {
    let default_url = "https://generativelanguage.googleapis.com";
    let url_base = base_url.unwrap_or(default_url);
    let url = format!("{}/v1beta/models/{}:streamGenerateContent?alt=sse&key={}", url_base, model, api_key);
    
    let client = reqwest::Client::new();
    
    let req_builder = client.post(&url)
        .header("Content-Type", "application/json")
        .json(request);
        
    let mut event_source = match reqwest_eventsource::EventSource::new(req_builder) {
        Ok(es) => es,
        Err(e) => return Err(e.to_string()),
    };
    
    Ok(async_stream::stream! {
        use futures::stream::StreamExt;
        use reqwest_eventsource::Event;
        
        while let Some(event_result) = event_source.next().await {
            match event_result {
                Ok(Event::Open) => continue,
                Ok(Event::Message(message)) => {
                    if message.data == "[DONE]" {
                        break;
                    }
                    match serde_json::from_str::<GeminiResponse>(&message.data) {
                        Ok(resp) => yield Ok(resp),
                        Err(e) => yield Err(format!("Failed to parse JSON: {}", e)),
                    }
                }
                Err(reqwest_eventsource::Error::StreamEnded) => {
                    break;
                }
                Err(e) => {
                    yield Err(format!("EventSource error: {}", e));
                    break;
                }
            }
        }
    })
}
