use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db:           PgPool,
    pub ollama_url:   String,
    pub ollama_model: String,
    pub jwt_secret:   String,
}

impl AppState {
    /// Placeholder vazio usado apenas para satisfazer o tipo em from_fn_with_state.
    /// Nunca e chamado em runtime.
    pub fn placeholder() -> Self {
        Self {
            db:           unsafe { std::mem::zeroed() },
            ollama_url:   String::new(),
            ollama_model: String::new(),
            jwt_secret:   String::new(),
        }
    }
}
