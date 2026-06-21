//! Teste e2e do dispatcher de webhooks: insere um webhook inscrito em
//! `chat_created`, dispara o evento e confirma que o receiver HTTP local recebe
//! a entrega assinada. Gated em DATABASE_URL (pula sem banco — CI sem DB passa).

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[tokio::test]
async fn webhook_is_dispatched_and_signed() {
    let Ok(db_url) = std::env::var("DATABASE_URL") else {
        eprintln!("skip: DATABASE_URL ausente");
        return;
    };
    let pool = sqlx::PgPool::connect(&db_url).await.expect("conecta no Postgres");

    // 1. Receiver local que captura exatamente 1 request HTTP.
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    tokio::spawn(async move {
        if let Ok((mut sock, _)) = listener.accept().await {
            let mut buf = vec![0u8; 8192];
            let n = sock.read(&mut buf).await.unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            let _ = sock
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
                .await;
            let _ = sock.flush().await;
            let _ = tx.send(req);
        }
    });

    // 2. Webhook inscrito em chat_created apontando para o receiver.
    let ws = uuid::Uuid::new_v4();
    let url = format!("http://127.0.0.1:{port}/hook");
    let webhook_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO webhooks (workspace_id, url, secret, events, status, timeout_secs)
         VALUES ($1, $2, $3, $4, 'active', 30) RETURNING id",
    )
    .bind(ws)
    .bind(&url)
    .bind("test-secret-123")
    .bind(serde_json::json!(["chat_created"]))
    .fetch_one(&pool)
    .await
    .expect("insere webhook de teste");

    // 3. Dispatcher + dispatch do evento.
    let dispatcher = webhooks::WebhookDispatcher::new(webhooks::WebhookStore::new(pool.clone()));
    dispatcher
        .dispatch(webhooks::WebhookEvent {
            event_type: webhooks::WebhookEventType::ChatCreated,
            workspace_id: ws.to_string(),
            data: serde_json::json!({ "chat_id": "abc-123" }),
            meta: None,
        })
        .await;

    // 4. Aguarda a entrega (worker em background faz a chamada HTTP).
    let received = tokio::time::timeout(std::time::Duration::from_secs(10), rx).await;

    // 5. Cleanup antes de asserir.
    let _ = sqlx::query("DELETE FROM webhooks WHERE id = $1")
        .bind(webhook_id)
        .execute(&pool)
        .await;

    let req = received
        .expect("timeout aguardando a entrega do webhook")
        .expect("canal do receiver fechado");
    assert!(req.starts_with("POST /hook"), "esperava POST /hook, veio: {req}");
    assert!(
        req.to_lowercase().contains("x-webhook-signature"),
        "esperava header de assinatura HMAC, veio: {req}"
    );
    assert!(
        req.contains("chat_created"),
        "esperava o tipo de evento no corpo, veio: {req}"
    );
}
