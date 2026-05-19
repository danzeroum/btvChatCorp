//! Modelos de request/response compativeis com a API da OpenAI.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---- Chat Completions ----

#[derive(Debug, Deserialize, ToSchema)]
pub struct ChatCompletionRequest {
    /// ID do modelo (ex: "btv-llama3", "gpt-4")
    pub model: String,
    /// Historico de mensagens
    pub messages: Vec<ChatMessage>,
    /// Temperatura de amostragem (0.0-2.0, default: 0.7)
    #[serde(default)]
    pub temperature: Option<f32>,
    /// Numero maximo de tokens na resposta
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// Habilitar streaming SSE
    #[serde(default)]
    pub stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct ChatMessage {
    /// "system", "user" ou "assistant"
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Usage,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Choice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ---- Embeddings ----

#[derive(Debug, Deserialize, ToSchema)]
pub struct EmbeddingRequest {
    pub model: String,
    pub input: EmbeddingInput,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum EmbeddingInput {
    Single(String),
    Batch(Vec<String>),
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmbeddingResponse {
    pub object: String,
    pub data: Vec<EmbeddingData>,
    pub model: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmbeddingData {
    pub object: String,
    pub index: u32,
    pub embedding: Vec<f32>,
}

// ---- Models ----

#[derive(Debug, Serialize, ToSchema)]
pub struct Model {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub owned_by: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ModelsResponse {
    pub object: String,
    pub data: Vec<Model>,
}
