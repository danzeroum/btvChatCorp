use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db:           PgPool,
    pub ollama_url:   String,
    pub ollama_model: String,
    pub jwt_secret:   String,
}
