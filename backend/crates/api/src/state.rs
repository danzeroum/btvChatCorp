use dashmap::DashMap;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;

use crate::services::admin_service::AdminService;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub ollama_url: String,
    pub ollama_model: String,
    /// Basic auth no formato "user:pass" — None para Ollama local sem auth
    pub ollama_auth: Option<String>,
    pub jwt_secret: String,
    /// Segredo para HMAC-SHA256 do hash de API keys.
    #[allow(dead_code)]
    pub api_key_hmac_secret: String,
    /// URL do Qdrant (ex: http://localhost:6333)
    pub qdrant_url: String,
    /// URL do servico de embedding Python (ex: http://localhost:8001)
    pub embedding_url: String,
    /// Serviço admin (métricas, usuários, configurações)
    pub admin_service: Arc<AdminService>,
    /// Rastreia tentativas de login por IP para proteção de brute-force.
    /// Valor: (contagem_de_falhas, timestamp_da_primeira_falha)
    pub login_attempts: Arc<DashMap<String, (u32, Instant)>>,
}
