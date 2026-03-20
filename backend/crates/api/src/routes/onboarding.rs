use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{errors::AppError, middleware::auth::Claims, state::AppState};

// --- Rotas protegidas (JWT obrigatorio) ---

pub fn protected_routes() -> Router<AppState> {
    Router::new()
        .route("/onboarding/step", post(advance_step))
        .route("/onboarding/checklist", get(get_checklist))
        .route("/onboarding/checklist/dismiss", post(dismiss_checklist))
        .route("/onboarding/invite", post(create_invite))
}

// --- Rotas publicas (sem JWT) ---

pub fn public_routes() -> Router<AppState> {
    Router::new().route("/onboarding/invite/accept", post(accept_invite))
}

// --- DTOs ---

#[derive(Deserialize, ToSchema)]
pub struct AdvanceStepDto {
    pub step: i32,
    pub data: Option<serde_json::Value>,
}

#[derive(Serialize, ToSchema)]
pub struct ChecklistResponse {
    pub items: serde_json::Value,
    pub completed_count: i32,
    pub total: i32,
    pub dismissed: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct InviteDto {
    pub email: String,
    pub role: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct AcceptInviteDto {
    pub token: String,
    pub name: String,
    pub password: String,
}

// --- Handlers ---

/// Avanca o wizard de onboarding para o proximo step
#[utoipa::path(
    post,
    path = "/api/v1/onboarding/step",
    tag = "onboarding",
    request_body = AdvanceStepDto,
    responses(
        (status = 200, description = "Step salvo"),
        (status = 401, description = "Nao autenticado"),
    )
)]
pub async fn advance_step(
    State(state): State<AppState>,
    claims: Claims,
    Json(dto): Json<AdvanceStepDto>,
) -> Result<StatusCode, AppError> {
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::bad_request("workspace_id invalido"))?;

    onboarding::provisioner::advance_step(&state.db, workspace_id, dto.step, dto.data).await?;
    Ok(StatusCode::OK)
}

/// Retorna status atual do checklist de onboarding
#[utoipa::path(
    get,
    path = "/api/v1/onboarding/checklist",
    tag = "onboarding",
    responses(
        (status = 200, description = "Status do checklist", body = ChecklistResponse),
        (status = 401, description = "Nao autenticado"),
    )
)]
pub async fn get_checklist(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<ChecklistResponse>, AppError> {
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::bad_request("workspace_id invalido"))?;

    let result = onboarding::checklist::get_checklist_status(&state.db, workspace_id).await?;
    Ok(Json(ChecklistResponse {
        items: result.items,
        completed_count: result.completed_count,
        total: result.total,
        dismissed: result.dismissed,
    }))
}

/// Dispensa o checklist de onboarding
#[utoipa::path(
    post,
    path = "/api/v1/onboarding/checklist/dismiss",
    tag = "onboarding",
    responses(
        (status = 200, description = "Checklist dispensado"),
        (status = 401, description = "Nao autenticado"),
    )
)]
pub async fn dismiss_checklist(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<StatusCode, AppError> {
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::bad_request("workspace_id invalido"))?;

    onboarding::checklist::dismiss_checklist(&state.db, workspace_id).await?;
    Ok(StatusCode::OK)
}

/// Envia convite de equipe para um email
#[utoipa::path(
    post,
    path = "/api/v1/onboarding/invite",
    tag = "onboarding",
    request_body = InviteDto,
    responses(
        (status = 201, description = "Convite criado"),
        (status = 401, description = "Nao autenticado"),
    )
)]
pub async fn create_invite(
    State(state): State<AppState>,
    claims: Claims,
    Json(dto): Json<InviteDto>,
) -> Result<StatusCode, AppError> {
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::bad_request("workspace_id invalido"))?;
    let invited_by =
        Uuid::parse_str(&claims.sub).map_err(|_| AppError::bad_request("user_id invalido"))?;

    let role = dto.role.unwrap_or_else(|| "user".into());
    onboarding::invite::create_invite(&state.db, workspace_id, invited_by, &dto.email, &role)
        .await?;
    Ok(StatusCode::CREATED)
}

/// Aceita convite e cria conta de usuario
#[utoipa::path(
    post,
    path = "/api/v1/onboarding/invite/accept",
    tag = "onboarding",
    request_body = AcceptInviteDto,
    responses(
        (status = 200, description = "Convite aceito, usuario criado"),
        (status = 404, description = "Token invalido ou expirado"),
    )
)]
pub async fn accept_invite(
    State(state): State<AppState>,
    Json(dto): Json<AcceptInviteDto>,
) -> Result<StatusCode, AppError> {
    let hash = bcrypt::hash(&dto.password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::internal("Erro ao processar senha"))?;

    onboarding::invite::accept_invite(&state.db, &dto.token, &dto.name, &hash).await?;
    Ok(StatusCode::OK)
}
