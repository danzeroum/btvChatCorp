use sqlx::PgPool;
use std::sync::Arc;
use reqwest::Client;

use crate::services::admin_service::AdminService;

/// Estado global compartilhado entre todos os handlers via Axum `State`.
/// Cada campo é um serviço ou cliente que precisa de acesso concorrente seguro.
#[derive(Clone)]
pub struct AppState {
    /// Pool de conexões PostgreSQL (sqlx)
    pub db: PgPool,

    /// Cliente HTTP reutilizável (reqwest) para chamadas externas
    pub http: Client,

    /// URL base do servidor vLLM (ex: http://gpu-server:8000)
    pub vllm_url: String,

    /// URL base do serviço de embeddings (ex: http://embedding-service:8001)
    pub embedding_url: String,

    /// URL base do Qdrant (ex: http://qdrant:6333)
    pub qdrant_url: String,

    /// Serviço do módulo admin (health, metrics, users, etc.)
    pub admin_service: Arc<AdminService>,

    /// Instante de início do servidor — usado para cálculo de uptime
    pub start_time: std::time::Instant,

    /// Chave secreta JWT para geração/validação de tokens
    pub jwt_secret: String,
}

impl AppState {
    pub fn new(
        db: PgPool,
        vllm_url: String,
        embedding_url: String,
        qdrant_url: String,
        jwt_secret: String,
    ) -> Self {
        let admin_service = Arc::new(AdminService::new(db.clone(), vllm_url.clone()));
        Self {
            db,
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            vllm_url,
            embedding_url,
            qdrant_url,
            admin_service,
            start_time: std::time::Instant::now(),
            jwt_secret,
        }
    }
}
