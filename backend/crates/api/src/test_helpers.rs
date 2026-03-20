#![cfg_attr(not(test), allow(dead_code))]
//! Utilitarios de teste de integracao.

#[cfg(test)]
pub use helpers::*;

#[cfg(test)]
pub mod helpers {
    use axum::Router;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    use crate::{routes, state::AppState};

    pub const TEST_JWT_SECRET: &str = "test_secret_for_ci_only";

    pub const DEFAULT_USER_ID: &str = "00000000-0000-0000-0000-000000000099";
    pub const DEFAULT_WORKSPACE_ID: &str = "00000000-0000-0000-0000-000000000001";

    #[derive(Serialize, Deserialize)]
    pub struct TestClaims {
        pub sub: String,
        pub workspace_id: String,
        pub role: String,
        pub exp: usize,
    }

    /// Garante que o workspace e o user padr\u{e3}o dos testes existem no banco.
    /// Usa ON CONFLICT DO NOTHING para ser idempotente entre testes paralelos.
    async fn seed_defaults(pool: &sqlx::PgPool) {
        sqlx::query(
            "INSERT INTO workspaces (id, name, plan)
             VALUES ($1, 'Test Workspace', 'free')
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(DEFAULT_WORKSPACE_ID.parse::<Uuid>().unwrap())
        .execute(pool)
        .await
        .expect("Falha ao seed workspace de teste");

        sqlx::query(
            "INSERT INTO users (id, workspace_id, name, email, password_hash, role)
             VALUES ($1, $2, 'Test User', 'test@ci.local', 'x', 'admin')
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(DEFAULT_USER_ID.parse::<Uuid>().unwrap())
        .bind(DEFAULT_WORKSPACE_ID.parse::<Uuid>().unwrap())
        .execute(pool)
        .await
        .expect("Falha ao seed user de teste");
    }

    pub async fn make_app() -> Router {
        let db_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL deve estar definida para os testes de integracao");

        let pool = sqlx::PgPool::connect(&db_url)
            .await
            .expect("Falha ao conectar ao banco de teste");

        seed_defaults(&pool).await;

        let state = AppState {
            db: pool,
            jwt_secret: TEST_JWT_SECRET.to_string(),
            ollama_url: std::env::var("OLLAMA_URL")
                .unwrap_or_else(|_| "http://localhost:11434".into()),
            ollama_model: std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.1:8b".into()),
            ollama_auth: None,
            qdrant_url: std::env::var("QDRANT_URL")
                .unwrap_or_else(|_| "http://localhost:6333".into()),
            embedding_url: std::env::var("EMBEDDING_URL")
                .unwrap_or_else(|_| "http://localhost:8001".into()),
        };

        axum::Router::new()
            .nest("/api/v1", routes::v1_routes(state.clone()))
            .with_state(state)
    }

    pub fn make_auth_header(role: &str) -> String {
        jwt_for_ids(DEFAULT_USER_ID, DEFAULT_WORKSPACE_ID, role)
    }

    pub fn make_auth_header_for_workspace(workspace_id: &str) -> String {
        let user_suffix = workspace_id
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>();
        let user_id = format!(
            "00000000-0000-0000-0000-{:0>12}",
            &user_suffix[user_suffix.len().saturating_sub(12)..]
        );
        jwt_for_ids(&user_id, workspace_id, "user")
    }

    fn jwt_for_ids(user_id: &str, workspace_id: &str, role: &str) -> String {
        let exp = (chrono::Utc::now().timestamp() + 3600) as usize;
        let claims = TestClaims {
            sub: user_id.to_string(),
            workspace_id: workspace_id.to_string(),
            role: role.to_string(),
            exp,
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(TEST_JWT_SECRET.as_bytes()),
        )
        .expect("Falha ao gerar token de teste");
        format!("Bearer {}", token)
    }

    #[allow(dead_code)]
    pub fn uuid(s: &str) -> Uuid {
        s.parse().expect("UUID invalido no helper de teste")
    }
}
