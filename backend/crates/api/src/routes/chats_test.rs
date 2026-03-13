#[cfg(test)]
mod chats_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use crate::test_helpers::{make_app, make_auth_header};

    async fn create_chat_helper(app: axum::Router, title: &str) -> String {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/chats")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "title": title }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await.unwrap();
        let chat: Value = serde_json::from_slice(&bytes).unwrap();
        chat["id"].as_str().unwrap().to_string()
    }

    #[tokio::test]
    async fn test_create_chat_returns_201() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app, "Minha conversa").await;
        assert!(!chat_id.is_empty());
    }

    #[tokio::test]
    async fn test_list_chats_returns_created_chat() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app.clone(), "Conversa listada").await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/chats")
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let chats: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(chats.iter().any(|c| c["id"] == chat_id));
    }

    #[tokio::test]
    async fn test_send_message_returns_assistant_response() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app.clone(), "Chat de teste").await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "content": "Ola, mundo!" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(msg["role"], "assistant");
        assert!(msg["content"].as_str().map(|s| !s.is_empty()).unwrap_or(false));
    }

    #[tokio::test]
    async fn test_get_messages_returns_history() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app.clone(), "Chat com historico").await;

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({ "content": "Primeira mensagem" }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(&format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let messages: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(messages.len() >= 2);
        assert_eq!(messages[0]["role"], "user");
        assert_eq!(messages[0]["content"], "Primeira mensagem");
    }

    #[tokio::test]
    async fn test_feedback_accepted() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app.clone(), "Chat feedback").await;

        let send_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "content": "Teste feedback" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes = axum::body::to_bytes(send_res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        let msg_id = msg["id"].as_str().unwrap();

        let feedback_res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!(
                        "/api/v1/chats/{}/messages/{}/feedback",
                        chat_id, msg_id
                    ))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "feedback": 1 }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(feedback_res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_feedback_invalid_value_returns_400() {
        let app = make_app().await;
        let chat_id = create_chat_helper(app.clone(), "Chat invalido").await;

        let send_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!("/api/v1/chats/{}/messages", chat_id))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "content": "msg" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes = axum::body::to_bytes(send_res.into_body(), usize::MAX).await.unwrap();
        let msg: Value = serde_json::from_slice(&bytes).unwrap();
        let msg_id = msg["id"].as_str().unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!(
                        "/api/v1/chats/{}/messages/{}/feedback",
                        chat_id, msg_id
                    ))
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "feedback": 0 }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_get_nonexistent_chat_returns_404() {
        let app = make_app().await;
        let fake_id = uuid::Uuid::new_v4();

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(&format!("/api/v1/chats/{}", fake_id))
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}
