use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use uuid::Uuid;

use crate::models::api_key::ApiKeyContext;
use crate::models::webhook::{
    CreateWebhookRequest, UpdateWebhookRequest,
    WebhookDeliveryResponse, WebhookResponse,
};
use crate_api::state::AppState;

pub fn webhook_routes() -> Router<AppState> {
    Router::new()
        .route("/webhooks", get(list_webhooks).post(create_webhook))
        .route("/webhooks/:id", get(get_webhook).put(update_webhook).delete(delete_webhook))
        .route("/webhooks/:id/test", post(test_webhook))
        .route("/webhooks/:id/deliveries", get(list_deliveries))
        .route("/webhooks/:id/deliveries/:delivery_id/retry", post(retry_delivery))
}

// ─── Handlers ────────────────────────────────────────────────────────────────

pub async fn list_webhooks(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
) -> Result<Json<Vec<WebhookResponse>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, url, description, events, status,
               consecutive_failures, last_delivery_at,
               last_delivery_status, created_at, updated_at
        FROM webhook_endpoints
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| WebhookResponse {
                id: r.id,
                name: r.name,
                url: r.url,
                description: r.description,
                events: r.events,
                status: r.status,
                consecutive_failures: r.consecutive_failures,
                last_delivery_at: r.last_delivery_at.map(|t| t.to_rfc3339()),
                last_delivery_status: r.last_delivery_status,
                created_at: r.created_at.to_rfc3339(),
                updated_at: r.updated_at.to_rfc3339(),
            })
            .collect(),
    ))
}

pub async fn create_webhook(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Json(req): Json<CreateWebhookRequest>,
) -> Result<(StatusCode, Json<WebhookResponse>), StatusCode> {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    // Gera secret HMAC se não fornecido
    let secret = req.secret.unwrap_or_else(|| {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        h.update(format!("{}{}", id, now.timestamp_nanos_opt().unwrap_or(0)).as_bytes());
        format!("whsec_{}", hex::encode(h.finalize()))
    });

    let delivery_config = serde_json::json!({
        "timeout": req.timeout_secs.unwrap_or(10),
        "max_retries": req.max_retries.unwrap_or(5),
        "headers": req.headers.unwrap_or_default(),
    });

    sqlx::query!(
        r#"
        INSERT INTO webhook_endpoints
            (id, workspace_id, name, url, description, secret,
             events, delivery_config, status,
             consecutive_failures, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',0,$9,$9)
        "#,
        id, ctx.workspace_id, req.name, req.url, req.description,
        secret, &req.events, delivery_config, now,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(WebhookResponse {
        id,
        name: req.name,
        url: req.url,
        description: req.description,
        events: req.events,
        status: "active".into(),
        consecutive_failures: 0,
        last_delivery_at: None,
        last_delivery_status: None,
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
    })))
}

pub async fn get_webhook(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        SELECT id, name, url, description, events, status,
               consecutive_failures, last_delivery_at,
               last_delivery_status, created_at, updated_at
        FROM webhook_endpoints
        WHERE id = $1 AND workspace_id = $2
        "#,
        id, ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(WebhookResponse {
        id: r.id, name: r.name, url: r.url,
        description: r.description, events: r.events, status: r.status,
        consecutive_failures: r.consecutive_failures,
        last_delivery_at: r.last_delivery_at.map(|t| t.to_rfc3339()),
        last_delivery_status: r.last_delivery_status,
        created_at: r.created_at.to_rfc3339(),
        updated_at: r.updated_at.to_rfc3339(),
    }))
}

pub async fn update_webhook(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateWebhookRequest>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        UPDATE webhook_endpoints SET
            name = COALESCE($3, name),
            url = COALESCE($4, url),
            events = COALESCE($5, events),
            status = COALESCE($6, status),
            updated_at = NOW()
        WHERE id = $1 AND workspace_id = $2
        RETURNING id, name, url, description, events, status,
                  consecutive_failures, last_delivery_at,
                  last_delivery_status, created_at, updated_at
        "#,
        id, ctx.workspace_id,
        req.name, req.url,
        req.events.as_deref(),
        req.status,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(WebhookResponse {
        id: r.id, name: r.name, url: r.url,
        description: r.description, events: r.events, status: r.status,
        consecutive_failures: r.consecutive_failures,
        last_delivery_at: r.last_delivery_at.map(|t| t.to_rfc3339()),
        last_delivery_status: r.last_delivery_status,
        created_at: r.created_at.to_rfc3339(),
        updated_at: r.updated_at.to_rfc3339(),
    }))
}

pub async fn delete_webhook(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2",
        id, ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 { return Err(StatusCode::NOT_FOUND); }
    Ok(StatusCode::NO_CONTENT)
}

/// Envia um evento de teste ao endpoint para validação
pub async fn test_webhook(
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let webhook = sqlx::query!(
        "SELECT url, secret FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2",
        id, ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    let test_payload = serde_json::json!({
        "id": Uuid::new_v4().to_string(),
        "type": "webhook.test",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "workspace_id": ctx.workspace_id.to_string(),
        "api_version": "2026-01-01",
        "data": { "message": "Webhook de teste enviado com sucesso!" }
    });

    let payload_bytes = serde_json::to_vec(&test_payload).unwrap_or_default();
    let signature = webhooks::signer::sign_payload(&webhook.secret, &payload_bytes);

    let resp = app
        .http
        .post(&webhook.url)
        .header("Content-Type", "application/json")
        .header("X-Webhook-Signature", &signature)
        .header("X-Webhook-ID", id.to_string())
        .body(payload_bytes)
        .send()
        .await;

    match resp {
        Ok(r) => Ok(Json(serde_json::json!({
            "success": r.status().is_success(),
            "http_status": r.status().as_u16(),
        }))),
        Err(e) => Ok(Json(serde_json::json!({
            "success": false,
            "error": e.to_string()
        }))),
    }
}

/// Lista histórico de entregas de um webhook
pub async fn list_deliveries(
    axum::extract::Extension(_ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WebhookDeliveryResponse>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, webhook_id, event_type, status, attempt_number,
               http_status, response_time_ms, error_message,
               scheduled_at, delivered_at, next_retry_at
        FROM webhook_deliveries
        WHERE webhook_id = $1
        ORDER BY scheduled_at DESC
        LIMIT 100
        "#,
        id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| WebhookDeliveryResponse {
                id: r.id,
                webhook_id: r.webhook_id,
                event_type: r.event_type,
                status: r.status,
                attempt_number: r.attempt_number,
                http_status: r.http_status,
                response_time_ms: r.response_time_ms,
                error_message: r.error_message,
                scheduled_at: r.scheduled_at.to_rfc3339(),
                delivered_at: r.delivered_at.map(|t| t.to_rfc3339()),
                next_retry_at: r.next_retry_at.map(|t| t.to_rfc3339()),
            })
            .collect(),
    ))
}

/// Re-tenta uma entrega específica manualmente
pub async fn retry_delivery(
    axum::extract::Extension(_ctx): axum::extract::Extension<ApiKeyContext>,
    State(app): State<AppState>,
    Path((_webhook_id, delivery_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE webhook_deliveries
        SET status = 'pending',
            next_retry_at = NOW(),
            attempt_number = attempt_number + 1
        WHERE id = $1
        "#,
        delivery_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::ACCEPTED)
}
