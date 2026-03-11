use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio_stream::wrappers::ReceiverStream;
use tokio::sync::mpsc;

use crate::errors::OrchestratorError;

// ─── Configuração ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct LlmConfig {
    /// URL base do vLLM (ex: http://gpu-server:8000)
    pub base_url: String,
    /// Nome do modelo/LoRA a usar
    pub model: String,
    /// Versão atual do LoRA adapter (ex: "lora_v3")
    pub lora_version: Option<String>,
    pub default_temperature: f32,
    pub default_max_tokens: u32,
}

impl LlmConfig {
    pub fn display_name(&self) -> String {
        match &self.lora_version {
            Some(v) => format!("{}-{}", self.model, v),
            None => self.model.clone(),
        }
    }
}

// ─── Tipos de request/response ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct VllmChatRequest {
    model: String,
    messages: Vec<VllmMessage>,
    temperature: f32,
    max_tokens: u32,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    lora_adapter: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VllmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct VllmResponse {
    choices: Vec<VllmChoice>,
    usage: VllmUsage,
}

#[derive(Debug, Deserialize)]
struct VllmChoice {
    message: VllmMessage,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
struct VllmStreamChunk {
    choices: Vec<VllmStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct VllmStreamChoice {
    delta: VllmDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct VllmDelta {
    #[serde(default)]
    content: String,
}

#[derive(Debug, Deserialize)]
struct VllmUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

/// Resposta completa (modo não-streaming)
#[derive(Debug, Clone)]
pub struct LlmResponse {
    pub text: String,
    pub finish_reason: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub model_version: String,
}

// ─── Cliente principal ────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct LlmClient {
    pub config: LlmConfig,
    http: Client,
}

impl LlmClient {
    pub fn new(config: LlmConfig) -> Self {
        Self {
            config,
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("Failed to build HTTP client"),
        }
    }

    // ─── Modo não-streaming (para avaliação, geração de QA sintético) ───────

    pub async fn chat(
        &self,
        messages: Vec<VllmMessage>,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<LlmResponse, OrchestratorError> {
        let body = VllmChatRequest {
            model: self.config.model.clone(),
            messages,
            temperature,
            max_tokens,
            stream: false,
            lora_adapter: self.config.lora_version.clone(),
        };

        let resp: VllmResponse = self
            .http
            .post(format!("{}/v1/chat/completions", self.config.base_url))
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        let choice = resp
            .choices
            .into_iter()
            .next()
            .ok_or_else(|| OrchestratorError::LlmInference("Empty choices".into()))?;

        Ok(LlmResponse {
            text: choice.message.content,
            finish_reason: choice.finish_reason,
            prompt_tokens: resp.usage.prompt_tokens,
            completion_tokens: resp.usage.completion_tokens,
            model_version: self.config.display_name(),
        })
    }

    // ─── Modo streaming (SSE → canal tokio) ─────────────────────────────────

    /// Retorna um `ReceiverStream<Result<String, OrchestratorError>>`.
    /// Cada item é um token de texto conforme o vLLM streama.
    pub async fn chat_stream(
        &self,
        messages: Vec<VllmMessage>,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<ReceiverStream<Result<String, OrchestratorError>>, OrchestratorError> {
        let body = VllmChatRequest {
            model: self.config.model.clone(),
            messages,
            temperature,
            max_tokens,
            stream: true,
            lora_adapter: self.config.lora_version.clone(),
        };

        let response = self
            .http
            .post(format!("{}/v1/chat/completions", self.config.base_url))
            .json(&body)
            .send()
            .await?;

        let (tx, rx) = mpsc::channel::<Result<String, OrchestratorError>>(128);

        // Processa o stream SSE do vLLM em background
        tokio::spawn(async move {
            let mut byte_stream = response.bytes_stream();

            while let Some(chunk_result) = byte_stream.next().await {
                match chunk_result {
                    Err(e) => {
                        let _ = tx
                            .send(Err(OrchestratorError::LlmStream(e.to_string())))
                            .await;
                        break;
                    }
                    Ok(bytes) => {
                        // Cada chunk SSE pode ter múltiplas linhas "data: {...}\n"
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            for line in text.lines() {
                                if let Some(json) = line.strip_prefix("data: ") {
                                    if json.trim() == "[DONE]" {
                                        break;
                                    }
                                    if let Ok(chunk) =
                                        serde_json::from_str::<VllmStreamChunk>(json)
                                    {
                                        if let Some(choice) = chunk.choices.into_iter().next() {
                                            if !choice.delta.content.is_empty() {
                                                if tx
                                                    .send(Ok(choice.delta.content))
                                                    .await
                                                    .is_err()
                                                {
                                                    return; // receiver dropped
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        Ok(ReceiverStream::new(rx))
    }
}
