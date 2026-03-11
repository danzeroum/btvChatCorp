use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use chrono::Utc;
use uuid::Uuid;

use crate::extractors::WorkspaceContext;

/// Middleware que grava uma entrada no audit_log para cada request
/// que modifica dados (POST, PUT, PATCH, DELETE).
/// Requests GET são ignorados para não poluir o log.
pub async fn audit_log_middleware(
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // Só loga requests de escrita
    let should_log = matches!(method.as_str(), "POST" | "PUT" | "PATCH" | "DELETE");

    // Captura contexto antes de consumir o request
    let ctx = request.extensions().get::<WorkspaceContext>().cloned();

    let response = next.run(request).await;

    if should_log {
        if let Some(ctx) = ctx {
            let action = infer_action(&method.as_str().to_lowercase(), &path);
            let status = response.status().as_u16();

            // Log assíncrono — não bloqueia a resposta
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
                // TODO: persistir em audit_logs via pool injetado
            });
        }
    }

    response
}

/// Infere a ação de audit a partir do método HTTP e path
fn infer_action(method: &str, path: &str) -> String {
    let resource = path
        .split('/')
        .filter(|s| !s.is_empty())
        .nth(1)  // ex: /admin/users -> "users"
        .unwrap_or("unknown");

    match method {
        "post"   => format!("{}.created", resource),
        "put"    => format!("{}.updated", resource),
        "patch"  => format!("{}.patched", resource),
        "delete" => format!("{}.deleted", resource),
        _        => format!("{}.action", resource),
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
