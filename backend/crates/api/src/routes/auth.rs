use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::{
    errors::AppError,
    middleware::auth::{AuthUser, Claims},
    state::AppState,
};

/// Rotas públicas de autenticação (sem JWT).
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
}

/// Rotas de autenticação que exigem JWT válido (aplicado pelo middleware no router pai).
pub fn protected_routes() -> Router<AppState> {
    Router::new().route("/auth/me", get(me))
}

/// Payload de registro de novo workspace + usuario owner
#[derive(Deserialize, ToSchema, Validate)]
pub struct RegisterDto {
    #[validate(length(
        min = 2,
        max = 80,
        message = "workspace_name deve ter entre 2 e 80 caracteres"
    ))]
    pub workspace_name: String,
    #[validate(length(min = 1, max = 120, message = "name obrigatorio (ate 120 caracteres)"))]
    pub name: String,
    #[validate(email(message = "email invalido"))]
    pub email: String,
    #[validate(length(
        min = 8,
        max = 128,
        message = "senha deve ter entre 8 e 128 caracteres"
    ))]
    pub password: String,
}

/// Payload de login
#[derive(Deserialize, ToSchema, Validate)]
pub struct LoginDto {
    #[validate(email(message = "email invalido"))]
    pub email: String,
    #[validate(length(min = 1, message = "senha obrigatoria"))]
    pub password: String,
}

/// Resposta de autenticacao com JWT
#[derive(Serialize, ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
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
    dto.validate()?;

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

    // Provisiona branding padrao + progresso de onboarding para o novo workspace
    onboarding::provisioner::provision_workspace(&state.db, workspace_id, &slug)
        .await
        .ok(); // nao bloqueia o registro em caso de falha

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, "owner")?;
    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user_id,
            workspace_id,
            name: dto.name,
            role: "owner".into(),
        }),
    ))
}

const LOGIN_MAX_ATTEMPTS: u32 = 5;
const LOGIN_WINDOW_SECS: u64 = 900; // 15 minutos

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("X-Real-IP")
        .or_else(|| headers.get("X-Forwarded-For"))
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
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
        (status = 429, description = "Muitas tentativas"),
    )
)]
async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(dto): Json<LoginDto>,
) -> Result<Json<AuthResponse>, AppError> {
    dto.validate()?;

    let client_ip = extract_client_ip(&headers);
    {
        let now = std::time::Instant::now();
        let mut entry = state
            .login_attempts
            .entry(client_ip.clone())
            .or_insert((0, now));
        let (count, since) = *entry;
        if since.elapsed().as_secs() >= LOGIN_WINDOW_SECS {
            *entry = (0, now);
        } else if count >= LOGIN_MAX_ATTEMPTS {
            return Err(AppError::too_many_requests(
                "Muitas tentativas de login. Tente novamente em alguns minutos.",
            ));
        }
    }

    let row: Option<(Uuid, Uuid, String, String, String, String)> = sqlx::query_as(
        "SELECT id, workspace_id, name, email, password_hash, role
         FROM users
         WHERE email = $1 AND is_active = true",
    )
    .bind(&dto.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AppError::internal("Erro interno"))?;

    let Some((user_id, workspace_id, name, _email, password_hash, role)) = row else {
        state
            .login_attempts
            .entry(client_ip.clone())
            .and_modify(|(c, t)| {
                *c += 1;
                *t = std::time::Instant::now();
            })
            .or_insert((1, std::time::Instant::now()));
        return Err(AppError::unauthorized("Email ou senha invalidos"));
    };

    if !bcrypt::verify(&dto.password, &password_hash).map_err(|_| AppError::internal("Erro"))? {
        state
            .login_attempts
            .entry(client_ip.clone())
            .and_modify(|(c, t)| {
                *c += 1;
                *t = std::time::Instant::now();
            })
            .or_insert((1, std::time::Instant::now()));
        return Err(AppError::unauthorized("Email ou senha invalidos"));
    }

    // Login bem-sucedido: limpa contagem de tentativas
    state.login_attempts.remove(&client_ip);

    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await
        .ok();

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, &role)?;
    Ok(Json(AuthResponse {
        token,
        user_id,
        workspace_id,
        name,
        role,
    }))
}

/// Dados da sessão autenticada (fonte da verdade no servidor, não no JWT client-side)
#[derive(Serialize, ToSchema)]
pub struct MeResponse {
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
}

/// Retorna os dados frescos do usuário autenticado. O frontend deve usar esta rota
/// para autorização (roles/workspace) em vez de decodificar o JWT no cliente.
#[utoipa::path(
    get,
    path = "/api/v1/auth/me",
    tag = "auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Dados do usuário autenticado", body = MeResponse),
        (status = 401, description = "Sessão inválida ou expirada"),
    )
)]
async fn me(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<MeResponse>, AppError> {
    let row: (Uuid, Uuid, String, String, String) = sqlx::query_as(
        "SELECT id, workspace_id, name, email, role
         FROM users
         WHERE id = $1 AND is_active = true",
    )
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::unauthorized("Sessão inválida"))?;

    let (user_id, workspace_id, name, email, role) = row;
    Ok(Json(MeResponse {
        user_id,
        workspace_id,
        name,
        email,
        role,
    }))
}

/// Payload de refresh: troca um token válido (não expirado) por um novo.
#[derive(Deserialize, ToSchema)]
pub struct RefreshDto {
    pub token: String,
}

/// Renova o JWT a partir de um token ainda válido. Não há refresh token de longa
/// duração — o access token tem vida curta (`JWT_EXPIRY_HOURS`) e deve ser renovado
/// enquanto válido. Tokens expirados são rejeitados (401), forçando novo login.
#[utoipa::path(
    post,
    path = "/api/v1/auth/refresh",
    tag = "auth",
    request_body = RefreshDto,
    responses(
        (status = 200, description = "Token renovado", body = AuthResponse),
        (status = 401, description = "Token inválido ou expirado"),
    )
)]
async fn refresh(
    State(state): State<AppState>,
    Json(dto): Json<RefreshDto>,
) -> Result<Json<AuthResponse>, AppError> {
    use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

    let data = decode::<Claims>(
        &dto.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::unauthorized("Token inválido ou expirado"))?;

    let claims = data.claims;
    let user_id: Uuid = claims
        .sub
        .parse()
        .map_err(|_| AppError::unauthorized("Token inválido"))?;
    let workspace_id: Uuid = claims
        .workspace_id
        .parse()
        .map_err(|_| AppError::unauthorized("Token inválido"))?;

    // Confirma que o usuário ainda existe e está ativo, e usa a role fresca do banco.
    let row: (String, String) =
        sqlx::query_as("SELECT name, role FROM users WHERE id = $1 AND is_active = true")
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| AppError::unauthorized("Sessão inválida"))?;
    let (name, role) = row;

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, &role)?;
    Ok(Json(AuthResponse {
        token,
        user_id,
        workspace_id,
        name,
        role,
    }))
}

fn make_jwt(
    secret: &str,
    user_id: Uuid,
    workspace_id: Uuid,
    role: &str,
) -> Result<String, AppError> {
    // Expiração curta e configurável (default 1h). Sem mais 30 dias hardcoded.
    let expiry_hours: i64 = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    let exp = (Utc::now() + chrono::Duration::hours(expiry_hours)).timestamp() as usize;
    encode(
        &Header::default(),
        &Claims {
            sub: user_id.to_string(),
            workspace_id: workspace_id.to_string(),
            role: role.into(),
            exp,
            iss: "btvchatcorp".into(),
            aud: vec!["btvchatcorp-api".into()],
        },
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::internal("Erro ao gerar token"))
}
