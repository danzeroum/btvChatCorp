#[cfg(test)]
mod documents_tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::test_helpers::{make_app, make_auth_header, make_auth_header_for_workspace};

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    // ── Testes ───────────────────────────────────────────────────────────────

    /// POST /api/v1/documents — upload válido deve retornar 201 + documento criado
    #[tokio::test]
    async fn test_upload_document_created() {
        let app = make_app().await;
        let (content_type, body) = multipart_body("relatorio.pdf", b"%PDF-1.4 fake content", "application/pdf");

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
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["original_filename"], "relatorio.pdf");
        assert_eq!(json["processing_status"], "pending");
    }

    /// POST sem arquivo deve retornar 400
    #[tokio::test]
    async fn test_upload_no_file_returns_400() {
        let app = make_app().await;
        let boundary = "----EmptyBoundary";
        let body = format!("--{0}--\r\n", boundary);

        let res = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header("user"))
                    .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    /// GET /api/v1/documents — deve retornar apenas docs do workspace do usuário
    #[tokio::test]
    async fn test_list_documents_scoped_to_workspace() {
        let app = make_app().await;

        // Upload com workspace A
        let (ct, body) = multipart_body("doc-a.txt", b"workspace a content", "text/plain");
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header_for_workspace("workspace-a"))
                    .header("Content-Type", ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Lista com workspace B — não deve ver o doc de A
        let res = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header_for_workspace("workspace-b"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let docs: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(
            docs.iter().all(|d| d["original_filename"] != "doc-a.txt"),
            "workspace B não deve ver documentos do workspace A"
        );
    }

    /// DELETE /api/v1/documents/:id — deve retornar 204
    #[tokio::test]
    async fn test_delete_document_returns_204() {
        let app = make_app().await;

        // Faz upload primeiro
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

        let bytes = axum::body::to_bytes(upload_res.into_body(), usize::MAX).await.unwrap();
        let doc: Value = serde_json::from_slice(&bytes).unwrap();
        let doc_id = doc["id"].as_str().unwrap();

        // Deleta
        let res = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(&format!("/api/v1/documents/{}", doc_id))
                    .header("Authorization", make_auth_header("user"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NO_CONTENT);
    }

    /// DELETE de documento de outro workspace deve retornar 404
    #[tokio::test]
    async fn test_delete_cross_workspace_returns_404() {
        let app = make_app().await;

        let (ct, body) = multipart_body("privado.txt", b"secreto", "text/plain");
        let upload_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/documents")
                    .header("Authorization", make_auth_header_for_workspace("workspace-owner"))
                    .header("Content-Type", ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        let bytes = axum::body::to_bytes(upload_res.into_body(), usize::MAX).await.unwrap();
        let doc: Value = serde_json::from_slice(&bytes).unwrap();
        let doc_id = doc["id"].as_str().unwrap();

        // Tenta deletar com workspace diferente
        let res = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(&format!("/api/v1/documents/{}", doc_id))
                    .header("Authorization", make_auth_header_for_workspace("workspace-attacker"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}
