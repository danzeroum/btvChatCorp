//! Testes de integração do chat com pipeline RAG.
//! Qdrant/Embedding não rodam em CI — o handler degrada graciosamente
//! e o LLM é mockado via OLLAMA_MOCK=true.

#[cfg(test)]
mod rag_integration_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::test_helpers::helpers::{
        make_app, make_auth_header, DEFAULT_WORKSPACE_ID,
    };

    // ── Helper ──────────────────────────────────────────────────────

    async fn create_chat_and_get_id(app: &axum::Router) -> String {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/chats")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"title": "Teste RAG"}"""))
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let chat: Value = serde_json::from_slice(&bytes).unwrap();
        chat["id"].as_str().unwrap().to_string()
    }

    // ── Testes ──────────────────────────────────────────────────────

    /// Chat retorna resposta mesmo sem Qdrant/Embedding no ar (RAG vazio).
    #[tokio::test]
    async fn send_message_works_without_rag() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app    = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Qual é a política de férias?"}"""))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(msg["role"].as_str().unwrap(), "assistant");
        assert!(!msg["content"].as_str().unwrap().is_empty());
    }

    /// Mock indica que não havia RAG disponível (Qdrant offline).
    #[tokio::test]
    async fn mock_response_shows_no_rag_when_qdrant_offline() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app     = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Teste sem Qdrant"}"""))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();

        // O mock indica "[sem contexto RAG]" quando Qdrant não respondeu
        let content = msg["content"].as_str().unwrap();
        assert!(content.contains("[mock]"), "Esperado [mock] no conteúdo: {}", content);
    }

    /// sources deve ser null quando não houver contexto RAG.
    #[tokio::test]
    async fn sources_null_when_no_rag_context() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app     = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Pergunta sem documentos"}"""))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();

        // sources deve ser null (nenhum documento na base ainda)
        assert!(msg["sources"].is_null(),
            "sources deveria ser null, got: {}", msg["sources"]);
    }

    /// Chat de outro workspace não acessa o chat.
    #[tokio::test]
    async fn chat_workspace_isolation() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app     = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        // Tenta mandar mensagem com token de workspace diferente
        let other_ws = "00000000-0000-0000-0000-000000000099";
        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization",
                        crate::test_helpers::helpers::make_auth_header_for_workspace(other_ws))
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"content": "Tentativa de cross-workspace"}"""))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NOT_FOUND,
            "Workspace diferente deveria retornar 404");
    }

    /// Mensagem vazia retorna 422 (validação do DTO).
    #[tokio::test]
    async fn empty_content_returns_unprocessable() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app     = make_app().await;
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
            "Esperado 422 ou 400, got {}", res.status()
        );
    }

    /// Testa que o histórico da conversa é mantido entre mensagens.
    #[tokio::test]
    async fn conversation_history_accumulates() {
        std::env::set_var("OLLAMA_MOCK", "true");
        let app     = make_app().await;
        let chat_id = create_chat_and_get_id(&app).await;

        // Envia 2 mensagens
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

        // Busca mensagens do chat
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
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let msgs: Value = serde_json::from_slice(&bytes).unwrap();
        let msgs = msgs.as_array().unwrap();

        // 2 mensagens do user + 2 do assistant = 4
        assert!(msgs.len() >= 4,
            "Esperado >= 4 mensagens, got {}", msgs.len());
    }
}
