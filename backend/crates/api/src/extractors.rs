use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Contexto do workspace injetado em cada request após autenticação JWT.
/// Extraído automaticamente pelo extractor do Axum nos handlers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceContext {
    /// ID do usuário autenticado
    pub user_id: Uuid,

    /// ID do workspace (multi-tenancy)
    pub workspace_id: Uuid,

    /// Nome do usuário
    pub user_name: String,

    /// Email do usuário
    pub user_email: String,

    /// Role do usuário no workspace (ex: Admin, Analyst, Viewer)
    pub role: String,

    /// Lista de permissões granulares (resource + actions)
    pub permissions: Vec<Permission>,

    /// Configuração do modelo de IA ativo para o workspace
    pub model_config: ModelConfig,

    /// Configurações do workspace (tom, idioma, empresa, etc.)
    pub company_name: String,
    pub sector: String,
    pub preferred_tone: Option<String>,
    pub language: Option<String>,
    pub custom_system_prompt: Option<String>,
    pub auto_anonymize: bool,
    pub sensitive_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub resource: String,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub version: String,
    pub lora_path: Option<String>,
    pub temperature: f64,
    pub max_tokens: i32,
    pub top_p: f64,
}

#[async_trait]
impl<S> FromRequestParts<S> for WorkspaceContext
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<WorkspaceContext>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}
