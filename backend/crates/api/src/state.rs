use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub ollama_url: String,
    pub ollama_model: String,
    /// Basic auth no formato "user:pass" — None para Ollama local sem auth
    pub ollama_auth: Option<String>,
    pub jwt_secret: String,
    /// Segredo para HMAC-SHA256 do hash de API keys.
    // Consumido pelo middleware de API key da `api-public` (crate fora do workspace — ver C12);
    // por isso o crate `api` sozinho não tem leitor e o lint o veria como morto.
    #[allow(dead_code)]
    pub api_key_hmac_secret: String,
    /// URL do Qdrant (ex: http://localhost:6333)
    pub qdrant_url: String,
    /// URL do servico de embedding Python (ex: http://localhost:8001)
    pub embedding_url: String,
}
