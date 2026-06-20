use axum::{
    extract::Request, extract::State, http::HeaderMap, middleware::Next, response::Response,
};
use chrono::Utc;
use uuid::Uuid;

use crate::extractors::WorkspaceContext;
use crate::state::AppState;

/// Middleware que grava uma entrada em `audit_logs` para cada request
/// que modifica dados (POST, PUT, PATCH, DELETE).
/// Requests GET são ignorados para não poluir o log.
///
/// A gravação é fire-and-forget (`tokio::spawn`): nunca bloqueia nem falha a
/// resposta do usuário — uma falha de INSERT é apenas logada via `tracing`.
pub async fn audit_log_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // Só loga requests de escrita
    let should_log = matches!(method.as_str(), "POST" | "PUT" | "PATCH" | "DELETE");

    // Captura contexto e IP antes de consumir o request
    let ctx = request.extensions().get::<WorkspaceContext>().cloned();
    let ip = client_ip(request.headers());

    let response = next.run(request).await;

    if should_log {
        if let Some(ctx) = ctx {
            let resource = resource_from_path(&path).to_string();
            let action = action_for(method.as_str(), &resource);
            let status = response.status().as_u16();
            let pool = state.db.clone();

            // Gravação assíncrona — não bloqueia a resposta
            tokio::spawn(async move {
                tracing::info!(
                    audit = true,
                    user_id = %ctx.user_id,
                    workspace_id = %ctx.workspace_id,
                    action = %action,
                    path = %path,
                    status = status,
                    timestamp = %Utc::now().to_rfc3339(),
                    "AUDIT"
                );

                let details = serde_json::json!({ "path": path, "status": status });
                if let Err(e) = sqlx::query(
                    "INSERT INTO audit_logs \
                     (workspace_id, user_id, action, resource, details, ip_address) \
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(ctx.workspace_id)
                .bind(ctx.user_id)
                .bind(&action)
                .bind(&resource)
                .bind(details)
                .bind(ip.as_deref())
                .execute(&pool)
                .await
                {
                    tracing::warn!("falha ao gravar audit_log ({}): {}", action, e);
                }
            });
        }
    }

    response
}

/// Extrai o IP do cliente a partir dos headers de proxy (nginx adiciona estes).
fn client_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Primeiro segmento significativo do path, ignorando o prefixo de versão
/// (ex: `/api/v1/chats/123` -> "chats", `/api/v1/admin/users` -> "admin").
fn resource_from_path(path: &str) -> &str {
    path.split('/')
        .filter(|s| !s.is_empty())
        .find(|s| !matches!(*s, "api" | "v1"))
        .unwrap_or("unknown")
}

/// Deriva a ação de audit a partir do método HTTP e do recurso.
fn action_for(method: &str, resource: &str) -> String {
    match method {
        "POST" => format!("{resource}.created"),
        "PUT" => format!("{resource}.updated"),
        "PATCH" => format!("{resource}.patched"),
        "DELETE" => format!("{resource}.deleted"),
        _ => format!("{resource}.action"),
    }
}

/// Entry estruturado para gravação manual no audit_log
/// (usado nos handlers que precisam de mais contexto)
#[derive(Debug, Default)]
pub struct AuditEntry {
    pub action: String,
    pub resource: String,
    pub resource_id: Option<Uuid>,
    pub user_id: Uuid,
    pub severity: String,
    pub details: Option<serde_json::Value>,
}

/// Macro helper para gravar audit entries manualmente nos handlers
#[macro_export]
macro_rules! audit_log {
    ($entry:expr) => {
        tokio::spawn(async move {
            tracing::info!(
                audit = true,
                action = %$entry.action,
                resource = %$entry.resource,
                user_id = %$entry.user_id,
                severity = %$entry.severity,
                "AUDIT_MANUAL"
            );
        });
    };
}
