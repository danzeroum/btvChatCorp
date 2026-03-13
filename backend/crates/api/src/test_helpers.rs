/// Utilitarios de teste de integracao.
/// Usado exclusivamente em contexto #[cfg(test)].

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

    #[derive(Serialize, Deserialize)]
    pub struct TestClaims {
        pub sub:          String,
        pub workspace_id: String,
        pub role:         String,
        pub exp:          usize,
    }

    /// Sobe o Router Axum completo apontado para o banco de teste (DATABASE_URL do env)
    pub async fn make_app() -> Router {
        let db_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL deve estar definida para os testes de integracao");

        let pool = sqlx::PgPool::connect(&db_url)
            .await
            .expect("Falha ao conectar ao banco de teste");

        let state = AppState {
            db:           pool,
            jwt_secret:   TEST_JWT_SECRET.to_string(),
            ollama_url:   std::env::var("OLLAMA_URL")
                            .unwrap_or_else(|_| "http://localhost:11434".into()),
            ollama_model: std::env::var("OLLAMA_MODEL")
                            .unwrap_or_else(|_| "llama3.1:8b".into()),
            ollama_auth:  None,
        };

        // v1_routes retorna Router<AppState>, precisamos de Router sem estado
        axum::Router::new()
            .nest("/api/v1", routes::v1_routes(state.clone()))
            .with_state(state)
    }

    /// JWT valido (+1h) para usuario generico no workspace de teste
    pub fn make_auth_header(role: &str) -> String {
        jwt_for_workspace("00000000-0000-0000-0000-000000000001", role)
    }

    /// JWT valido (+1h) para workspace especifico
    pub fn make_auth_header_for_workspace(workspace_id: &str) -> String {
        jwt_for_workspace(workspace_id, "user")
    }

    fn jwt_for_workspace(workspace_id: &str, role: &str) -> String {
        let exp = (chrono::Utc::now().timestamp() + 3600) as usize;
        let claims = TestClaims {
            sub:          Uuid::new_v4().to_string(),
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
}
