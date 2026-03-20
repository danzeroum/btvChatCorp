use sqlx::PgPool;

/// Resolve o workspace_id a partir do host HTTP.
/// Tenta primeiro domínio customizado (ai.acme.com),
/// depois subdomínio padrão (acme.aiplatform.com).
pub async fn resolve_workspace_from_domain(host: &str, db: &PgPool) -> Option<String> {
    // 1. Tenta domínio customizado
    let ws: Option<String> = sqlx::query_scalar(
        "SELECT workspace_id::text FROM workspace_brandings
         WHERE custom_domain = $1 AND custom_domain_status = 'active'",
    )
    .bind(host)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    if ws.is_some() {
        return ws;
    }

    // 2. Tenta subdomínio padrão (*.aiplatform.com)
    if let Some(subdomain) = host.strip_suffix(".aiplatform.com") {
        let ws2: Option<String> = sqlx::query_scalar(
            "SELECT workspace_id::text FROM workspace_brandings WHERE subdomain = $1",
        )
        .bind(subdomain)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();
        return ws2;
    }

    None
}
