use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{errors::AppError, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/branding/theme.css", get(get_theme_css))
        .route("/branding/config.json", get(get_config))
}

#[derive(Deserialize)]
pub struct SubdomainQuery {
    pub subdomain: Option<String>,
}

/// Configuracao publica de branding (sem dados sensiveis)
#[derive(Serialize, ToSchema)]
pub struct BrandingConfigResponse {
    pub platform_name: String,
    pub company_name: String,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub chat_bot_name: String,
    pub chat_welcome_message: String,
    pub chat_placeholder: String,
    pub feature_flags: serde_json::Value,
}

/// Retorna CSS com variaveis de tema para o workspace
#[utoipa::path(
    get,
    path = "/api/v1/branding/theme.css",
    tag = "branding",
    params(
        ("subdomain" = Option<String>, Query, description = "Subdominio do workspace")
    ),
    responses(
        (status = 200, description = "CSS do tema", content_type = "text/css"),
        (status = 404, description = "Workspace nao encontrado"),
    )
)]
pub async fn get_theme_css(
    State(state): State<AppState>,
    Query(q): Query<SubdomainQuery>,
) -> Result<Response, AppError> {
    let subdomain = q.subdomain.unwrap_or_else(|| "default".into());

    let row: Option<(serde_json::Value,)> =
        sqlx::query_as("SELECT theme FROM workspace_brandings WHERE subdomain = $1")
            .bind(&subdomain)
            .fetch_optional(&state.db)
            .await?;

    let theme = match row {
        Some((t,)) => t,
        None => serde_json::json!({
            "primary": "2563EB", "secondary": "7C3AED",
            "background": "FFFFFF", "surface": "F8FAFC",
            "sidebarBg": "0F172A", "sidebarText": "E2E8F0",
            "textPrimary": "0F172A", "textSecondary": "64748B",
            "textOnPrimary": "FFFFFF", "border": "E2E8F0",
            "fontFamily": "Inter, system-ui, sans-serif",
            "borderRadius": "8px", "borderRadiusLg": "12px",
            "customCss": ""
        }),
    };

    let css = branding::css_generator::generate_css(&theme);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/css; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        css,
    )
        .into_response())
}

/// Retorna configuracao publica de branding
#[utoipa::path(
    get,
    path = "/api/v1/branding/config.json",
    tag = "branding",
    params(
        ("subdomain" = Option<String>, Query, description = "Subdominio do workspace")
    ),
    responses(
        (status = 200, description = "Config publica de branding", body = BrandingConfigResponse),
    )
)]
pub async fn get_config(
    State(state): State<AppState>,
    Query(q): Query<SubdomainQuery>,
) -> Result<Json<BrandingConfigResponse>, AppError> {
    let subdomain = q.subdomain.unwrap_or_else(|| "default".into());

    let row: Option<(
        String,
        String,
        Option<String>,
        Option<String>,
        String,
        String,
        String,
        serde_json::Value,
    )> = sqlx::query_as(
        "SELECT platform_name, company_name, logo_url, favicon_url,
                chat_bot_name, chat_welcome_message, chat_placeholder, feature_flags
         FROM workspace_brandings WHERE subdomain = $1",
    )
    .bind(&subdomain)
    .fetch_optional(&state.db)
    .await?;

    let resp = match row {
        Some((
            platform_name,
            company_name,
            logo_url,
            favicon_url,
            chat_bot_name,
            chat_welcome_message,
            chat_placeholder,
            feature_flags,
        )) => BrandingConfigResponse {
            platform_name,
            company_name,
            logo_url,
            favicon_url,
            chat_bot_name,
            chat_welcome_message,
            chat_placeholder,
            feature_flags,
        },
        None => BrandingConfigResponse {
            platform_name: "AI Platform".into(),
            company_name: "Empresa".into(),
            logo_url: None,
            favicon_url: None,
            chat_bot_name: "Assistente".into(),
            chat_welcome_message: "Ola! Como posso ajudar?".into(),
            chat_placeholder: "Faca uma pergunta...".into(),
            feature_flags: serde_json::json!({"showPoweredBy": true}),
        },
    };

    Ok(Json(resp))
}
