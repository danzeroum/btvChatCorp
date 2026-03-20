#[cfg(test)]
mod documents_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use serde_json::Value;
    use tower::util::ServiceExt;

    use crate::test_helpers::{
        make_app, make_auth_header, make_auth_header_for_workspace_seeded,
    };

    fn multipart_body(filename: &str, content: &[u8], mime: &str) -> (String, Vec<u8>) {
        let boundary = "----TestBoundary123";
        let mut body = Vec::new();
        let header = format!(
            "--{}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\nContent-Type: {}\r\n\r\n",
            boundary, filename, mime
        );
        body.extend_from_slice(header.as_bytes());
        body.extend_from_slice(content);
        body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());
        (format!("multipart/form-data; boundary={}", boundary), body)
    }

    #[tokio::test]
    async fn test_upload_document_created() {
        let app: Router = make_app().await;
        let (content_type, body) =
            multipart_body("relatorio.pdf", b"%PDF-1.4 fake content", "application/pdf");

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", content_type)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::CREATED);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["original_filename"], "relatorio.pdf");
        assert_eq!(json["processing_status"], "pending");
    }

    #[tokio::test]
    async fn test_upload_no_file_returns_400() {
        let app: Router = make_app().await;
        let boundary = "----EmptyBoundary";
        let body = format!("--{0}--\r\n", boundary);

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header("user"))
                    .header(
                        "Content-Type",
                        format!("multipart/form-data; boundary={}", boundary),
                    )
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_list_documents_scoped_to_workspace() {
        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool = sqlx::PgPool::connect(&db_url).await.unwrap();

        let auth_ws10 = make_auth_header_for_workspace_seeded(
            &pool,
            "00000000-0000-0000-0000-000000000010",
        )
        .await;
        let auth_ws20 = make_auth_header_for_workspace_seeded(
            &pool,
            "00000000-0000-0000-0000-000000000020",
        )
        .await;

        let app: Router = make_app().await;

        let (ct, body) = multipart_body("doc-a.txt", b"workspace a content", "text/plain");
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", auth_ws10)
                    .header("Content-Type", ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/documents")
                    .header("Authorization", auth_ws20)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        let docs: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(
            docs.iter().all(|d| d["original_filename"] != "doc-a.txt"),
            "workspace B nao deve ver documentos do workspace A"
        );
    }

    #[tokio::test]
    async fn test_delete_document_returns_204() {
        let app: Router = make_app().await;

        let (ct, body) = multipart_body("para-deletar.txt", b"conteudo", "text/plain");
        let upload_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes = axum::body::to_bytes(upload_res.into_body(), usize::MAX)
            .await
            .unwrap();
        let doc: Value = serde_json::from_slice(&bytes).unwrap();
        let doc_id = doc["id"].as_str().unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/documents/{}", doc_id))
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn test_delete_cross_workspace_returns_404() {
        let db_url = std::env::var("DATABASE_URL").unwrap();
        let pool = sqlx::PgPool::connect(&db_url).await.unwrap();

        let auth_ws30 = make_auth_header_for_workspace_seeded(
            &pool,
            "00000000-0000-0000-0000-000000000030",
        )
        .await;
        let auth_ws40 = make_auth_header_for_workspace_seeded(
            &pool,
            "00000000-0000-0000-0000-000000000040",
        )
        .await;

        let app: Router = make_app().await;

        let (ct, body) = multipart_body("privado.txt", b"secreto", "text/plain");
        let upload_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", auth_ws30)
                    .header("Content-Type", ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes = axum::body::to_bytes(upload_res.into_body(), usize::MAX)
            .await
            .unwrap();
        let doc: Value = serde_json::from_slice(&bytes).unwrap();
        let doc_id = doc["id"].as_str().unwrap();

        let res = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/documents/{}", doc_id))
                    .header("Authorization", auth_ws40)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}
