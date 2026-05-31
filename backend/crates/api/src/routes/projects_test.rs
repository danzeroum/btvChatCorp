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
