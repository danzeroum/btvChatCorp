#![cfg_attr(not(test), allow(dead_code))]
//! Utilitarios de teste de integracao.
//! Usado exclusivamente em contexto #[cfg(test)].

#[cfg(test)]
pub use helpers::*;

#[cfg(test)]
pub mod helpers {
    use axum::Router;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    use crate::{
        routes,
        state::AppState,
    };

    pub const TEST_JWT_SECRET: &str = "test_secret_for_ci_only";

    // User IDs fixos por workspace para garantir consistencia entre chamadas
    // do mesmo teste (create e list usam o mesmo user_id).
    pub const DEFAULT_USER_ID: &str      = "00000000-0000-0000-0000-000000000099";
    pub const DEFAULT_WORKSPACE_ID: &str = "00000000-0000-0000-0000-000000000001";

    #[derive(Serialize, Deserialize)]
    pub struct TestClaims {
        pub sub: String,
        pub workspace_id: String,
        pub role: String,
        pub exp: usize,
    }

    /// Sobe o Router Axum completo apontado para o banco de teste (DATABASE_URL do env)
    pub async fn make_app() -> Router {
        let db_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL deve estar definida para os testes de integracao");

        let pool = sqlx::PgPool::connect(&db_url)
            .await
            .expect("Falha ao conectar ao banco de teste");

        let state = AppState {
            db: pool,
            jwt_secret: TEST_JWT_SECRET.to_string(),
            ollama_url: std::env::var("OLLAMA_URL")
                .unwrap_or_else(|_| "http://localhost:11434".into()),
            ollama_model: std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama3.1:8b".into()),
            ollama_auth: None,
        };

        axum::Router::new()
            .nest("/api/v1", routes::v1_routes(state.clone()))
            .with_state(state)
    }

    /// JWT valido (+1h) com user_id e workspace_id fixos para testes
    pub fn make_auth_header(role: &str) -> String {
        jwt_for_ids(DEFAULT_USER_ID, DEFAULT_WORKSPACE_ID, role)
    }

    /// JWT valido (+1h) para workspace especifico (user_id fixo derivado do workspace)
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
            sub:          user_id.to_string(),
            workspace_id: workspace_id.to_string(),
            role:         role.to_string(),
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

    /// Converte UUID string em Uuid (panic se invalido — aceitavel em testes)
    #[allow(dead_code)]
    pub fn uuid(s: &str) -> Uuid {
        s.parse().expect("UUID invalido no helper de teste")
    }
}
