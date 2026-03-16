use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{errors::AppError, middleware::auth::Claims, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login",    post(login))
}

/// Payload de registro de novo workspace + usuario owner
#[derive(Deserialize, ToSchema)]
pub struct RegisterDto {
    /// Nome do workspace (ex: "Acme Corp")
    pub workspace_name: String,
    /// Nome completo do usuario
    pub name: String,
    /// Email do usuario
    pub email: String,
    /// Senha (minimo 8 caracteres)
    pub password: String,
}

/// Payload de login
#[derive(Deserialize, ToSchema)]
pub struct LoginDto {
    pub email: String,
    pub password: String,
}

/// Resposta de autenticacao com JWT
#[derive(Serialize, ToSchema)]
pub struct AuthResponse {
    /// JWT Bearer token
    pub token: String,
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    /// Role do usuario: owner | admin | member
    pub role: String,
}

/// Registra novo workspace e usuario owner
#[utoipa::path(
    post,
    path = "/api/v1/auth/register",
    tag = "Auth",
    request_body = RegisterDto,
    responses(
        (status = 201, description = "Workspace e usuario criados", body = AuthResponse),
        (status = 409, description = "Email ou slug de workspace ja em uso"),
        (status = 422, description = "Dados invalidos"),
    )
)]
async fn register(
    State(state): State<AppState>,
    Json(dto): Json<RegisterDto>,
) -> Result<(StatusCode, Json<AuthResponse>), AppError> {
    let workspace_id = Uuid::new_v4();
    let slug = dto.workspace_name.to_lowercase().replace(' ', "-")
        .chars().filter(|c| c.is_alphanumeric() || *c == '-').collect::<String>();

    sqlx::query(
        "INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)",
    )
    .bind(workspace_id).bind(&dto.workspace_name).bind(&slug)
    .execute(&state.db).await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.constraint() == Some("workspaces_slug_key") =>
            AppError::conflict("Nome de workspace ja em uso"),
        _ => AppError::from(e),
    })?;

    let hash = bcrypt::hash(&dto.password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::internal("Erro ao processar senha"))?;
    let user_id = Uuid::new_v4();

    // Coluna correta: role_name (definida em 0001_auth.sql)
    sqlx::query(
        "INSERT INTO users (id,workspace_id,name,email,password_hash,role_name) VALUES ($1,$2,$3,$4,$5,'owner')",
    )
    .bind(user_id).bind(workspace_id).bind(&dto.name).bind(&dto.email).bind(&hash)
    .execute(&state.db).await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.constraint() == Some("users_workspace_id_email_key") =>
            AppError::conflict("Email ja cadastrado"),
        _ => AppError::from(e),
    })?;

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, "owner")?;
    Ok((StatusCode::CREATED, Json(AuthResponse { token, user_id, workspace_id, name: dto.name, role: "owner".into() })))
}

/// Autentica usuario e retorna JWT
#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    tag = "Auth",
    request_body = LoginDto,
    responses(
        (status = 200, description = "Login realizado", body = AuthResponse),
        (status = 401, description = "Email ou senha invalidos"),
    )
)]
async fn login(
    State(state): State<AppState>,
    Json(dto): Json<LoginDto>,
) -> Result<Json<AuthResponse>, AppError> {
    // role_name (schema real) | status='active' em vez de is_active
    let row: (Uuid, Uuid, String, String, String, String) = sqlx::query_as(
        "SELECT id,workspace_id,name,email,password_hash,role_name FROM users WHERE email=$1 AND status='active'",
    )
    .bind(&dto.email)
    .fetch_one(&state.db).await
    .map_err(|_| AppError::unauthorized("Email ou senha invalidos"))?;

    let (user_id, workspace_id, name, _email, password_hash, role) = row;

    if !bcrypt::verify(&dto.password, &password_hash).map_err(|_| AppError::internal("Erro"))? {
        return Err(AppError::unauthorized("Email ou senha invalidos"));
    }

    sqlx::query("UPDATE users SET last_login_at=NOW() WHERE id=$1")
        .bind(user_id).execute(&state.db).await.ok();

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, &role)?;
    Ok(Json(AuthResponse { token, user_id, workspace_id, name, role }))
}

fn make_jwt(secret: &str, user_id: Uuid, workspace_id: Uuid, role: &str) -> Result<String, AppError> {
    let exp = (Utc::now() + chrono::Duration::days(30)).timestamp() as usize;
    encode(
        &Header::default(),
        &Claims { sub: user_id.to_string(), workspace_id: workspace_id.to_string(), role: role.into(), exp },
        &EncodingKey::from_secret(secret.as_bytes()),
    ).map_err(|_| AppError::internal("Erro ao gerar token"))
}
