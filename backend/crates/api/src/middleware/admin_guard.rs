use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::extractors::WorkspaceContext;

/// Middleware Axum que bloqueia rotas /admin/* para usuários sem permissão
/// `workspace:manage`. Registra tentativas de acesso no audit log.
pub async fn require_admin_role(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extrai o contexto do workspace injetado pelo auth interceptor
    let ctx = request
        .extensions()
        .get::<WorkspaceContext>()
        .cloned()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let has_admin = ctx.permissions.iter().any(|p| {
        p.resource == "workspace" && p.actions.contains(&"manage".to_string())
    });

    if !has_admin {
        tracing::warn!(
            user_id = %ctx.user_id,
            path = %request.uri().path(),
            "[ADMIN] Acesso negado — usuário sem permissão workspace:manage"
        );
        // TODO: gravar em audit_logs de forma async
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}
