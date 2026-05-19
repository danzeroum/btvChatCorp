//! Configuracao centralizada da aplicacao.
//!
//! Carrega e valida todas as variaveis de ambiente uma unica vez
//! no startup. Qualquer variavel obrigatoria ausente causa panic
//! imediato com mensagem descritiva.

use std::env;

/// Configuracao imutavel do servidor API.
///
/// Construida uma unica vez em `main` via [`AppConfig::from_env`]
/// e distribuida para o [`AppState`] via clone.
#[derive(Clone, Debug)]
pub struct AppConfig {
    // --- Banco de dados ---
    pub database_url:   String,
    pub db_max_conn:    u32,

    // --- LLM / Ollama ---
    pub ollama_url:     String,
    pub ollama_model:   String,
    /// Basic auth no formato "user:pass" — None para Ollama sem auth
    pub ollama_auth:    Option<String>,

    // --- Seguranca ---
    pub jwt_secret:     String,

    // --- Servicos externos ---
    pub qdrant_url:     String,
    pub embedding_url:  String,

    // --- Servidor ---
    pub bind_addr:      String,
}

impl AppConfig {
    /// Le e valida o ambiente; chama `panic!` com mensagem clara se
    /// alguma variavel obrigatoria estiver ausente.
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let database_url = require("DATABASE_URL");
        let jwt_secret   = require("JWT_SECRET");

        let ollama_auth = match env::var("OLLAMA_AUTH_USER").ok() {
            Some(u) => {
                let p = env::var("OLLAMA_AUTH_PASS").unwrap_or_default();
                Some(format!("{}:{}", u, p))
            }
            None => None,
        };

        Self {
            database_url,
            db_max_conn: env_u32("DB_MAX_CONN", 10),
            ollama_url:    opt("OLLAMA_URL",    "https://api.buildtovalue.cloud"),
            ollama_model:  opt("OLLAMA_MODEL",  "mistral:latest"),
            ollama_auth,
            jwt_secret,
            qdrant_url:    opt("QDRANT_URL",    "http://localhost:6333"),
            embedding_url: opt("EMBEDDING_URL", "http://localhost:8001"),
            bind_addr:     opt("BIND_ADDR",     "0.0.0.0:3000"),
        }
    }
}

// ------------------------------------------------------------------
// Helpers privados
// ------------------------------------------------------------------

fn require(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| {
        panic!(
            "[config] Variavel de ambiente obrigatoria ausente: {}\n\
             Defina-a no .env ou no ambiente do container.",
            key
        )
    })
}

fn opt(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.into())
}

fn env_u32(key: &str, default: u32) -> u32 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
