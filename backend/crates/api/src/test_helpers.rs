//! Utilitários compartilhados entre os módulos de teste de integração.
//!
//! Exporta:
//! - `make_app()` — sobe a aplicação Axum conectada ao banco de teste
//! - `make_auth_header(role)` — gera JWT assinado com secret de teste para usuário genérico
//! - `make_auth_header_for_workspace(workspace_id)` — JWT com workspace específico

#[cfg(test)]
pub mod test_helpers {
    use axum::Router;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;
    use std::sync::Arc;

    use crate::{
        routes,
        state::AppState,
    };

    pub const TEST_JWT_SECRET: &str = "test_secret_for_ci_only";
    pub const TEST_WORKSPACE_A: &str = "00000000-0000-0000-0000-000000000001";
    pub const TEST_WORKSPACE_B: &str = "00000000-0000-0000-0000-000000000002";

    #[derive(Serialize, Deserialize)]
    struct TestClaims {
        sub:          String,
        workspace_id: String,
        role:         String,
        exp:          usize,
    }

    /// Cria e retorna o Router Axum configurado contra o banco de teste (DATABASE_URL do env)
    pub async fn make_app() -> Router {
        let db_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL deve estar definida para os testes de integração");

        let pool = sqlx::PgPool::connect(&db_url)
            .await
            .expect("Falha ao conectar ao banco de teste");

        let state = AppState {
            db:           pool,
            jwt_secret:   TEST_JWT_SECRET.to_string(),
            ollama_url:   std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".into()),
            ollama_model: std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.1:8b".into()),
            ollama_auth:  None,
        };

        routes::app_router(state)
    }

    /// JWT válido (+1h) para um usuário genérico no workspace A
    pub fn make_auth_header(role: &str) -> String {
        let claims = TestClaims {
            sub:          Uuid::new_v4().to_string(),
            workspace_id: TEST_WORKSPACE_A.to_string(),
            role:         role.to_string(),
            exp:          (chrono::Utc::now().timestamp() + 3600) as usize,
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
        )
        .expect("Falha ao gerar token de teste");
        format!("Bearer {}", token)
    }

    /// JWT válido (+1h) para um usuário em workspace específico
    pub fn make_auth_header_for_workspace(workspace_id: &str) -> String {
        let claims = TestClaims {
            sub:          Uuid::new_v4().to_string(),
            workspace_id: workspace_id.to_string(),
            role:         "user".to_string(),
            exp:          (chrono::Utc::now().timestamp() + 3600) as usize,
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
        )
        .expect("Falha ao gerar token de teste");
        format!("Bearer {}", token)
    }
}
