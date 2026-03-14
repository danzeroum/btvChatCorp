#[cfg(test)]
mod training_tests {
    use axum::{
        body::{Body, to_bytes},
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::test_helpers::helpers::{
        make_app, make_auth_header,
        DEFAULT_WORKSPACE_ID,
    };

    // ── helpers internos ──────────────────────────────────────────────────────

    /// Insere uma training_interaction aprovada para usar nos testes
    async fn seed_interaction(pool: &sqlx::PgPool, workspace_id: &str) -> String {
        let row: (uuid::Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO training_interactions
                (workspace_id, user_message, assistant_response,
                 user_rating, curator_status, eligible_for_training)
            VALUES ($1, 'Qual e o prazo do contrato?', 'O prazo e de 12 meses.',
                    'positive', 'approved', true)
            RETURNING id
            "#,
        )
        .bind(workspace_id.parse::<uuid::Uuid>().unwrap())
        .fetch_one(pool)
        .await
        .unwrap();
        row.0.to_string()
    }

    /// Insere uma interaction com status 'pending' para testes de curadoria
    async fn seed_pending_interaction(pool: &sqlx::PgPool, workspace_id: &str) -> String {
        let row: (uuid::Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO training_interactions
                (workspace_id, user_message, assistant_response,
                 user_rating, curator_status, eligible_for_training)
            VALUES ($1, 'Como funciona o suporte?', 'O suporte funciona 24h.',
                    'negative', 'pending', true)
            RETURNING id
            "#,
        )
        .bind(workspace_id.parse::<uuid::Uuid>().unwrap())
        .fetch_one(pool)
        .await
        .unwrap();
        row.0.to_string()
    }

    // ── testes ────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_list_queue_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/training/queue")
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let list: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(list.is_array());
    }

    #[tokio::test]
    async fn test_approve_interaction_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        // Conecta direto ao banco para seed
        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool   = sqlx::PgPool::connect(&db_url).await.unwrap();
        let id     = seed_pending_interaction(&pool, DEFAULT_WORKSPACE_ID).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/v1/training/queue/{}/approve", id))
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_reject_interaction_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool   = sqlx::PgPool::connect(&db_url).await.unwrap();
        let id     = seed_pending_interaction(&pool, DEFAULT_WORKSPACE_ID).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/v1/training/queue/{}/reject", id))
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_list_batches_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/training/batches")
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let list: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(list.is_array());
    }

    #[tokio::test]
    async fn test_start_batch_returns_201() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        // Garante que existe pelo menos 1 exemplo aprovado
        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool   = sqlx::PgPool::connect(&db_url).await.unwrap();
        seed_interaction(&pool, DEFAULT_WORKSPACE_ID).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/training/batches")
                    .header("Authorization", auth)
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::json!({"base_model": "llama3.1:8b", "total_epochs": 2})
                            .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::CREATED);
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let batch: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(batch["status"], "running");
        assert!(batch["external_job_id"].as_str().unwrap().starts_with("mock-job-"));
    }

    #[tokio::test]
    async fn test_start_batch_no_examples_returns_400() {
        let app  = make_app().await;
        // Usa workspace diferente que nao tem exemplos aprovados
        let auth = crate::test_helpers::helpers::make_auth_header_for_workspace(
            "00000000-0000-0000-0000-000000000099",
        );

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/training/batches")
                    .header("Authorization", auth)
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::json!({}).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_poll_batch_status_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        // Garante batch existente
        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool   = sqlx::PgPool::connect(&db_url).await.unwrap();
        seed_interaction(&pool, DEFAULT_WORKSPACE_ID).await;

        // Cria batch via API para ter ID valido
        let app2 = make_app().await;
        let auth2 = make_auth_header("user");
        let create_res = app2
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/training/batches")
                    .header("Authorization", auth2)
                    .header("Content-Type", "application/json")
                    .body(Body::from(serde_json::json!({}).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes  = to_bytes(create_res.into_body(), usize::MAX).await.unwrap();
        let batch: Value = serde_json::from_slice(&bytes).unwrap();
        let batch_id = batch["id"].as_str().unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/training/batches/{}/status", batch_id))
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let status: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(status["status"].is_string());
        assert!(status["progress"].is_number());
    }

    #[tokio::test]
    async fn test_list_documents_returns_200() {
        let app  = make_app().await;
        let auth = make_auth_header("user");

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/training/documents")
                    .header("Authorization", auth)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
    }
}
