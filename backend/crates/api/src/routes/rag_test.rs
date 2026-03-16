//! Testes de integracao do chat com pipeline RAG.
//! Qdrant/Embedding nao rodam em CI -- o handler degrada graciosamente
//! e o LLM e mockado via OLLAMA_MOCK=true.

#[cfg(test)]
mod rag_integration_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::test_helpers::helpers::{make_app, make_auth_header, DEFAULT_WORKSPACE_ID};

    async fn create_chat_and_get_id(app: &axum::Router) -> String {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/chats")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"title": "Teste RAG"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let chat: Value = serde_json::from_slice(&bytes).unwrap();
        chat["id"].as_str().unwrap().to_string()
    }

    #[tokio::test]
    async fn send_message_works_without_rag() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Qual e a politica de ferias?"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(msg["role"].as_str().unwrap(), "assistant");
        assert!(!msg["content"].as_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn mock_response_shows_no_rag_when_qdrant_offline() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Teste sem Qdrant"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        let content = msg["content"].as_str().unwrap();
        assert!(content.contains("[mock]"), "Esperado [mock] no conteudo: {}", content);
    }

    #[tokio::test]
    async fn sources_null_when_no_rag_context() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Pergunta sem documentos"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(
            msg["sources"].is_null(),
            "sources deveria ser null, got: {}",
            msg["sources"]
        );
    }

    #[tokio::test]
    async fn chat_workspace_isolation() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let other_ws = "00000000-0000-0000-0000-000000000099";
        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header(
                        "Authorization",
                        crate::test_helpers::helpers::make_auth_header_for_workspace(other_ws),
                    )
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Tentativa de cross-workspace"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            res.status(),
            StatusCode::NOT_FOUND,
            "Workspace diferente deveria retornar 404"
        );
    }

    #[tokio::test]
    async fn empty_content_returns_unprocessable() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(
            res.status() == StatusCode::UNPROCESSABLE_ENTITY
                || res.status() == StatusCode::BAD_REQUEST,
            "Esperado 422 ou 400, got {}",
            res.status()
        );
    }

    #[tokio::test]
    async fn conversation_history_accumulates() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        for i in 1..=2u32 {
            let body = format!(r#"{{"content": "Mensagem {}"}}""", i);
            app.clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/v1/chats/{}/messages", chat_id))
                        .header("Authorization", make_auth_header("user"))
                        .header("Content-Type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();
        }

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let msgs: Value = serde_json::from_slice(&bytes).unwrap();
        let msgs = msgs.as_array().unwrap();
        assert!(
            msgs.len() >= 4,
            "Esperado >= 4 mensagens, got {}",
            msgs.len()
        );
    }

    // Suprime warning de unused import DEFAULT_WORKSPACE_ID
    // (usado implicitamente via make_auth_header que referencia DEFAULT_WORKSPACE_ID)
    const _: &str = DEFAULT_WORKSPACE_ID;
}
