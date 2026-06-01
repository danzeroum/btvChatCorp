#[cfg(test)]
mod projects_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::{json, Value};
    use tower::util::ServiceExt;

    use crate::test_helpers::{make_app, make_auth_header};

    async fn create_project(app: Router, name: &str) -> String {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/projects")
                    .header("Authorization", make_auth_header("owner"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "name": name }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let v: Value = serde_json::from_slice(&bytes).unwrap();
        v["id"].as_str().unwrap().to_string()
    }

    /// POST /api/v1/projects deve criar o projeto (201) com `created_by`
    /// preenchido a partir do `sub` do JWT.
    #[tokio::test]
    async fn test_create_project() {
        let app: Router = make_app().await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/projects")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({
                            "name": "Projeto de Teste",
                            "description": "Criado pelo teste de integracao",
                            "priority": "high",
                            "tags": ["ci", "teste"]
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let project: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(project["id"].as_str().is_some());
        assert_eq!(project["name"], "Projeto de Teste");
        assert!(project["created_by"].as_str().is_some());
    }

    /// GET /api/v1/projects/:id/chats retorna array puro com o chat criado via POST /chats.
    #[tokio::test]
    async fn test_project_chats_list() {
        let app: Router = make_app().await;
        let pid = create_project(app.clone(), "Projeto Chats Test").await;

        // Cria chat com project_id
        let chat_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/chats")
                    .header("Authorization", make_auth_header("owner"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({ "title": "Chat do Projeto", "project_id": pid }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(chat_res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(chat_res.into_body(), usize::MAX).await.unwrap();
        let chat: Value = serde_json::from_slice(&bytes).unwrap();
        let chat_id = chat["id"].as_str().unwrap().to_string();

        // Lista chats do projeto
        let list_res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/projects/{pid}/chats"))
                    .header("Authorization", make_auth_header("owner"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(list_res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(list_res.into_body(), usize::MAX).await.unwrap();
        let chats: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(chats.iter().any(|c| c["id"] == chat_id), "chat nao encontrado na lista");
        assert!(chats[0]["message_count"].is_number(), "message_count ausente");
    }

    /// GET /api/v1/projects/:id/members retorna array puro (pode ser vazio sem project_members).
    #[tokio::test]
    async fn test_project_members_list() {
        let app: Router = make_app().await;
        let pid = create_project(app.clone(), "Projeto Members Test").await;

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/projects/{pid}/members"))
                    .header("Authorization", make_auth_header("owner"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let members: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        // Array puro (pode estar vazio — project_members nao e preenchido automaticamente)
        assert!(members.is_empty() || members[0]["user_id"].is_string());
    }

    /// POST /projects/:id/instructions + GET retorna array puro com a instrucao criada.
    #[tokio::test]
    async fn test_project_instructions_roundtrip() {
        let app: Router = make_app().await;
        let pid = create_project(app.clone(), "Projeto Instrucoes Test").await;

        let post_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/projects/{pid}/instructions"))
                    .header("Authorization", make_auth_header("owner"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({
                            "name": "Inst Teste",
                            "content": "Responda sempre em portugues.",
                            "trigger_mode": "always",
                            "is_active": true
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(post_res.status(), StatusCode::CREATED);

        let get_res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/projects/{pid}/instructions"))
                    .header("Authorization", make_auth_header("owner"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(get_res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(get_res.into_body(), usize::MAX).await.unwrap();
        let instructions: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(
            instructions.iter().any(|i| i["name"] == "Inst Teste"),
            "instrucao nao encontrada na lista"
        );
    }

    /// GET /api/v1/projects deve listar o projeto recem-criado.
    #[tokio::test]
    async fn test_list_projects_returns_created() {
        let app: Router = make_app().await;

        let create_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/projects")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", "application/json")
                    .body(Body::from(json!({ "name": "Projeto Listado" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(create_res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(create_res.into_body(), usize::MAX)
            .await
            .unwrap();
        let created: Value = serde_json::from_slice(&bytes).unwrap();
        let id = created["id"].as_str().unwrap().to_string();

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/projects")
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
        let projects: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(projects.iter().any(|p| p["id"] == id));
    }
}
