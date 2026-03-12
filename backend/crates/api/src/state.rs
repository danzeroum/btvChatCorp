use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db:           PgPool,
    pub ollama_url:   String,
    pub ollama_model: String,
    /// Basic auth no formato "user:pass" — None para Ollama local sem auth
    pub ollama_auth:  Option<String>,
    pub jwt_secret:   String,
}
