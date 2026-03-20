use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;

use crate::{css_generator::BrandTheme, generate_theme_css, resolve_workspace_from_domain};

#[derive(Clone)]
pub struct BrandingState {
    pub db: PgPool,
}

pub fn branding_routes() -> Router<BrandingState> {
    Router::new()
        .route("/branding/theme.css", get(serve_theme_css))
        .route("/branding/config.json", get(serve_branding_config))
}

#[derive(Serialize)]
pub struct BrandingPublicConfig {
    pub company_name: String,
    pub platform_name: String,
    pub tagline: Option<String>,
    pub logo_url: Option<String>,
    pub logomark_url: Option<String>,
    pub favicon_url: Option<String>,
    pub chat_welcome_message: String,
    pub chat_placeholder: String,
    pub chat_bot_name: String,
    pub chat_bot_avatar: Option<String>,
    pub login_page_title: Option<String>,
    pub login_page_subtitle: Option<String>,
    pub login_background_url: Option<String>,
    pub terms_url: Option<String>,
    pub privacy_url: Option<String>,
    pub support_email: Option<String>,
    pub feature_flags: Value,
}

async fn serve_theme_css(
    State(state): State<BrandingState>,
    axum::TypedHeader(host): axum::TypedHeader<axum::headers::Host>,
) -> Result<Response, StatusCode> {
    let host_str = host.hostname();
    let workspace_id = resolve_workspace_from_domain(host_str, &state.db)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let row: Option<(Value,)> = sqlx::query_as(
        "SELECT theme FROM workspace_brandings WHERE workspace_id = $1",
    )
    .bind(workspace_id.parse::<uuid::Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (theme_json,) = row.ok_or(StatusCode::NOT_FOUND)?;
    let theme: BrandTheme = serde_json::from_value(theme_json).unwrap_or_default();
    let css = generate_theme_css(&theme);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/css"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        css,
    )
        .into_response())
}

async fn serve_branding_config(
    State(state): State<BrandingState>,
    axum::TypedHeader(host): axum::TypedHeader<axum::headers::Host>,
) -> Result<Json<BrandingPublicConfig>, StatusCode> {
    let host_str = host.hostname();
    let workspace_id = resolve_workspace_from_domain(host_str, &state.db)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let row = sqlx::query_as::<_, (
        String, String, Option<String>, Option<String>, Option<String>, Option<String>,
        String, String, String, Option<String>,
        Option<String>, Option<String>, Option<String>,
        Option<String>, Option<String>, Option<String>, Value,
    )>(
        r#"SELECT company_name, platform_name, tagline, logo_url, logomark_url, favicon_url,
                  chat_welcome_message, chat_placeholder, chat_bot_name, chat_bot_avatar,
                  login_page_title, login_page_subtitle, login_background_url,
                  terms_url, privacy_url, support_email, feature_flags
           FROM workspace_brandings WHERE workspace_id = $1"#,
    )
    .bind(workspace_id.parse::<uuid::Uuid>().map_err(|_| StatusCode::BAD_REQUEST)?)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(BrandingPublicConfig {
        company_name:          row.0,
        platform_name:         row.1,
        tagline:               row.2,
        logo_url:              row.3,
        logomark_url:          row.4,
        favicon_url:           row.5,
        chat_welcome_message:  row.6,
        chat_placeholder:      row.7,
        chat_bot_name:         row.8,
        chat_bot_avatar:       row.9,
        login_page_title:      row.10,
        login_page_subtitle:   row.11,
        login_background_url:  row.12,
        terms_url:             row.13,
        privacy_url:           row.14,
        support_email:         row.15,
        feature_flags:         row.16,
    }))
}
