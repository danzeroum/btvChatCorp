use dashmap::DashMap;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;

use crate::services::admin_service::AdminService;

pub struct AppState {
    pub db: PgPool,
    pub ollama_url: String,
    pub ollama_model: String,
    /// Basic auth no formato "user:pass" — None para Ollama local sem auth
    pub ollama_auth: Option<String>,
    /// Arc<str> evita cópias desnecessárias em stack traces e logs ao clonar o estado.
    pub jwt_secret: Arc<str>,
    /// Arc<str> pelo mesmo motivo que jwt_secret.
    #[allow(dead_code)]
    pub api_key_hmac_secret: Arc<str>,
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

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
            ollama_url: self.ollama_url.clone(),
            ollama_model: self.ollama_model.clone(),
            ollama_auth: self.ollama_auth.clone(),
            jwt_secret: Arc::clone(&self.jwt_secret),
            api_key_hmac_secret: Arc::clone(&self.api_key_hmac_secret),
            qdrant_url: self.qdrant_url.clone(),
            embedding_url: self.embedding_url.clone(),
            admin_service: Arc::clone(&self.admin_service),
            login_attempts: Arc::clone(&self.login_attempts),
        }
    }
}
