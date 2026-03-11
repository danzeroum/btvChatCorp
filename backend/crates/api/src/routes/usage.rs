use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};

use crate::{extractors::WorkspaceContext, state::AppState};

pub fn usage_routes() -> Router<AppState> {
    Router::new()
        .route("/usage", get(get_usage_summary))
        .route("/usage/breakdown", get(get_usage_breakdown))
        .route("/usage/daily", get(get_daily_usage))
        .route("/usage/export", get(export_usage_csv))
}

// ─── Query params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UsageQuery {
    pub from: Option<String>,    // ISO 8601
    pub to: Option<String>,
    pub project_id: Option<String>,
    pub user_id: Option<String>,
}

// ─── Response structs ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct UsageSummaryResponse {
    pub workspace_id: String,
    pub period_from: String,
    pub period_to: String,
    pub total_requests: i64,
    pub total_prompt_tokens: i64,
    pub total_completion_tokens: i64,
    pub total_tokens: i64,
    pub total_documents_uploaded: i64,
    pub total_documents_indexed: i64,
    pub estimated_cost_brl: f64,
    pub active_users: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageBreakdownItem {
    pub label: String,
    pub requests: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub estimated_cost_brl: f64,
}

#[derive(Debug, Serialize)]
pub struct DailyUsageItem {
    pub date: String,
    pub requests: i64,
    pub total_tokens: i64,
    pub estimated_cost_brl: f64,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// Resumo geral de uso do workspace no período
pub async fn get_usage_summary(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(params): Query<UsageQuery>,
) -> Result<Json<UsageSummaryResponse>, StatusCode> {
    let from = params.from.as_deref().unwrap_or("NOW() - INTERVAL '30 days'");
    let to = params.to.as_deref().unwrap_or("NOW()");

    let stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*)                            AS total_requests,
            COALESCE(SUM(prompt_tokens), 0)     AS total_prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens,
            COUNT(DISTINCT user_id)             AS active_users
        FROM training_interactions
        WHERE workspace_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
        "#,
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let docs = sqlx::query!(
        r#"
        SELECT
            COUNT(*) AS total_uploaded,
            COUNT(*) FILTER (WHERE processing_status = 'indexed') AS total_indexed
        FROM documents
        WHERE workspace_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
        "#,
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Custo estimado: ~R$0.001 por 1k tokens (ajustar conforme pricing real)
    let total_tokens = stats.total_tokens.unwrap_or(0);
    let estimated_cost_brl = (total_tokens as f64 / 1000.0) * 0.001;

    Ok(Json(UsageSummaryResponse {
        workspace_id: ctx.workspace_id.to_string(),
        period_from: from.to_string(),
        period_to: to.to_string(),
        total_requests: stats.total_requests.unwrap_or(0),
        total_prompt_tokens: stats.total_prompt_tokens.unwrap_or(0),
        total_completion_tokens: stats.total_completion_tokens.unwrap_or(0),
        total_tokens,
        total_documents_uploaded: docs.total_uploaded.unwrap_or(0),
        total_documents_indexed: docs.total_indexed.unwrap_or(0),
        estimated_cost_brl,
        active_users: stats.active_users.unwrap_or(0),
    }))
}

/// Breakdown de uso por projeto ou por usuário
pub async fn get_usage_breakdown(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(params): Query<UsageQuery>,
) -> Result<Json<Vec<UsageBreakdownItem>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT
            COALESCE(p.name, 'Sem projeto') AS label,
            COUNT(ti.id) AS requests,
            COALESCE(SUM(ti.prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(ti.completion_tokens), 0) AS completion_tokens
        FROM training_interactions ti
        LEFT JOIN project_chats pc ON pc.chat_id = ti.chat_id
        LEFT JOIN projects p ON p.id = pc.project_id
        WHERE ti.workspace_id = $1
          AND ti.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.name
        ORDER BY requests DESC
        LIMIT 20
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| {
                let total = r.prompt_tokens.unwrap_or(0) + r.completion_tokens.unwrap_or(0);
                UsageBreakdownItem {
                    label: r.label.unwrap_or_else(|| "Sem projeto".into()),
                    requests: r.requests.unwrap_or(0),
                    prompt_tokens: r.prompt_tokens.unwrap_or(0),
                    completion_tokens: r.completion_tokens.unwrap_or(0),
                    estimated_cost_brl: (total as f64 / 1000.0) * 0.001,
                }
            })
            .collect(),
    ))
}

/// Série temporal diária de uso
pub async fn get_daily_usage(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(_params): Query<UsageQuery>,
) -> Result<Json<Vec<DailyUsageItem>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT
            DATE(created_at)                               AS date,
            COUNT(*)                                       AS requests,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens
        FROM training_interactions
        WHERE workspace_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| DailyUsageItem {
                date: r.date.map(|d| d.to_string()).unwrap_or_default(),
                requests: r.requests.unwrap_or(0),
                total_tokens: r.total_tokens.unwrap_or(0),
                estimated_cost_brl: (r.total_tokens.unwrap_or(0) as f64 / 1000.0) * 0.001,
            })
            .collect(),
    ))
}

/// Export CSV de uso do período
pub async fn export_usage_csv(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(_params): Query<UsageQuery>,
) -> Result<(StatusCode, [(axum::http::HeaderName, String); 2], String), StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT
            DATE(created_at) AS date,
            COUNT(*) AS requests,
            COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens
        FROM training_interactions
        WHERE workspace_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut csv = String::from("date,requests,total_tokens,estimated_cost_brl\n");
    for r in rows {
        let tokens = r.total_tokens.unwrap_or(0);
        let cost = (tokens as f64 / 1000.0) * 0.001;
        csv.push_str(&format!(
            "{},{},{},{:.6}\n",
            r.date.map(|d| d.to_string()).unwrap_or_default(),
            r.requests.unwrap_or(0),
            tokens,
            cost,
        ));
    }

    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "text/csv".to_string()),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"usage.csv\"".to_string()),
        ],
        csv,
    ))
}
