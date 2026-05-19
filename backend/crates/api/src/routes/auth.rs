use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{errors::AppError, middleware::auth::Claims, state::AppState};

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login",    post(login))
        .route("/auth/refresh",  post(refresh))
        .route("/auth/me",       get(me))
}

// ------------------------------------------------------------------
// DTOs
// ------------------------------------------------------------------

#[derive(Deserialize, ToSchema)]
pub struct RegisterDto {
    pub workspace_name: String,
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginDto {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, ToSchema)]
pub struct RefreshDto {
    pub refresh_token: String,
}

/// Resposta de autenticacao: inclui access_token (1h) e refresh_token (30d)
#[derive(Serialize, ToSchema)]
pub struct AuthResponse {
    pub access_token:  String,
    pub refresh_token: String,
    /// Segundos ate a expiracao do access_token
    pub expires_in:    u64,
    pub user_id:       Uuid,
    pub workspace_id:  Uuid,
    pub name:          String,
    pub role:          String,
}

/// Dados publicos do usuario autenticado
#[derive(Serialize, ToSchema)]
pub struct MeResponse {
    pub user_id:      Uuid,
    pub workspace_id: Uuid,
    pub name:         String,
    pub email:        String,
    pub role:         String,
}

// Claims separadas para o refresh token
#[derive(Debug, Serialize, Deserialize)]
struct RefreshClaims {
    sub:          String,
    workspace_id: String,
    role:         String,
    /// "refresh" — distingue do access token
    kind:         String,
    exp:          usize,
}

// ------------------------------------------------------------------
// Handlers
// ------------------------------------------------------------------

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
    let slug = dto
        .workspace_name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>();

    sqlx::query("INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)")
        .bind(workspace_id)
        .bind(&dto.workspace_name)
        .bind(&slug)
        .execute(&state.db)
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(db) if db.constraint() == Some("workspaces_slug_key") => {
                AppError::conflict("Nome de workspace ja em uso")
            }
            _ => AppError::from(e),
        })?;

    let hash = bcrypt::hash(&dto.password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::internal("Erro ao processar senha"))?;
    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, workspace_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'owner')",
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(&dto.name)
    .bind(&dto.email)
    .bind(&hash)
    .execute(&state.db)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.constraint() == Some("users_workspace_id_email_key") => {
            AppError::conflict("Email ja cadastrado")
        }
        _ => AppError::from(e),
    })?;

    onboarding::provisioner::provision_workspace(&state.db, workspace_id, &slug)
        .await
        .ok();

    let access_token  = make_access_jwt(&state.jwt_secret,   user_id, workspace_id, "owner")?;
    let refresh_token = make_refresh_jwt(&state.jwt_secret,  user_id, workspace_id, "owner")?;
    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            access_token,
            refresh_token,
            expires_in: 3600,
            user_id,
            workspace_id,
            name: dto.name,
            role: "owner".into(),
        }),
    ))
}

/// Autentica usuario e retorna par de tokens
#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    tag = "Auth",
    request_body = LoginDto,
    responses(
        (status = 200, description = "Login realizado",        body = AuthResponse),
        (status = 401, description = "Email ou senha invalidos"),
    )
)]
async fn login(
    State(state): State<AppState>,
    Json(dto): Json<LoginDto>,
) -> Result<Json<AuthResponse>, AppError> {
    let row: (Uuid, Uuid, String, String, String, String) = sqlx::query_as(
        "SELECT id, workspace_id, name, email, password_hash, role
         FROM users
         WHERE email = $1 AND is_active = true",
    )
    .bind(&dto.email)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::unauthorized("Email ou senha invalidos"))?;

    let (user_id, workspace_id, name, _email, password_hash, role) = row;

    if !bcrypt::verify(&dto.password, &password_hash).map_err(|_| AppError::internal("Erro"))? {
        return Err(AppError::unauthorized("Email ou senha invalidos"));
    }

    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await
        .ok();

    let access_token  = make_access_jwt(&state.jwt_secret,  user_id, workspace_id, &role)?;
    let refresh_token = make_refresh_jwt(&state.jwt_secret, user_id, workspace_id, &role)?;
    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        expires_in: 3600,
        user_id,
        workspace_id,
        name,
        role,
    }))
}

/// Emite novo access_token a partir de um refresh_token valido
#[utoipa::path(
    post,
    path = "/api/v1/auth/refresh",
    tag = "Auth",
    request_body = RefreshDto,
    responses(
        (status = 200, description = "Novo par de tokens emitido", body = AuthResponse),
        (status = 401, description = "Refresh token invalido ou expirado"),
    )
)]
async fn refresh(
    State(state): State<AppState>,
    Json(dto): Json<RefreshDto>,
) -> Result<Json<AuthResponse>, AppError> {
    let token_data = decode::<RefreshClaims>(
        &dto.refresh_token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::unauthorized("Refresh token invalido ou expirado"))?;

    let claims = token_data.claims;
    if claims.kind != "refresh" {
        return Err(AppError::unauthorized("Token nao e' do tipo refresh"));
    }

    let user_id      = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::unauthorized("Token invalido"))?;
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::unauthorized("Token invalido"))?;

    // Verifica que o usuario ainda esta ativo
    let row: (String, String, bool) = sqlx::query_as(
        "SELECT name, role, is_active FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::unauthorized("Usuario nao encontrado"))?;

    let (name, role, is_active) = row;
    if !is_active {
        return Err(AppError::unauthorized("Conta desativada"));
    }

    let access_token  = make_access_jwt(&state.jwt_secret,  user_id, workspace_id, &role)?;
    let refresh_token = make_refresh_jwt(&state.jwt_secret, user_id, workspace_id, &role)?;
    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        expires_in: 3600,
        user_id,
        workspace_id,
        name,
        role,
    }))
}

/// Retorna dados do usuario autenticado
#[utoipa::path(
    get,
    path = "/api/v1/auth/me",
    tag = "Auth",
    security(
        ("BearerAuth" = [])
    ),
    responses(
        (status = 200, description = "Dados do usuario",  body = MeResponse),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn me(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<MeResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::unauthorized("Token invalido"))?;

    let row: (String, String, String) = sqlx::query_as(
        "SELECT name, email, role FROM users WHERE id = $1 AND is_active = true",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::not_found("Usuario nao encontrado"))?;

    let (name, email, role) = row;
    let workspace_id = Uuid::parse_str(&claims.workspace_id)
        .map_err(|_| AppError::unauthorized("Token invalido"))?;

    Ok(Json(MeResponse {
        user_id,
        workspace_id,
        name,
        email,
        role,
    }))
}

// ------------------------------------------------------------------
// Helpers JWT
// ------------------------------------------------------------------

/// Access token: expira em 1 hora
fn make_access_jwt(
    secret: &str,
    user_id: Uuid,
    workspace_id: Uuid,
    role: &str,
) -> Result<String, AppError> {
    let exp = (Utc::now() + chrono::Duration::hours(1)).timestamp() as usize;
    encode(
        &Header::default(),
        &Claims {
            sub:          user_id.to_string(),
            workspace_id: workspace_id.to_string(),
            role:         role.into(),
            exp,
        },
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::internal("Erro ao gerar access token"))
}

/// Refresh token: expira em 30 dias, claim `kind = "refresh"`
fn make_refresh_jwt(
    secret: &str,
    user_id: Uuid,
    workspace_id: Uuid,
    role: &str,
) -> Result<String, AppError> {
    let exp = (Utc::now() + chrono::Duration::days(30)).timestamp() as usize;
    encode(
        &Header::default(),
        &RefreshClaims {
            sub:          user_id.to_string(),
            workspace_id: workspace_id.to_string(),
            role:         role.into(),
            kind:         "refresh".into(),
            exp,
        },
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::internal("Erro ao gerar refresh token"))
}
