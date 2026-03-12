use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{errors::AppError, middleware::auth::Claims, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login",    post(login))
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct RegisterDto {
    workspace_name: String,
    name:           String,
    email:          String,
    password:       String,
}

#[derive(Deserialize)]
struct LoginDto {
    email:    String,
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token:        String,
    user_id:      Uuid,
    workspace_id: Uuid,
    name:         String,
    role:         String,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async fn register(
    State(state): State<AppState>,
    Json(dto): Json<RegisterDto>,
) -> Result<(StatusCode, Json<AuthResponse>), AppError> {
    // Cria workspace
    let workspace_id = Uuid::new_v4();
    let slug = dto.workspace_name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>();

    sqlx::query!(
        "INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)",
        workspace_id, dto.workspace_name, slug,
    )
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db) if db.constraint() == Some("workspaces_slug_key") =>
            AppError::conflict("Nome de workspace já em uso"),
        _ => AppError::from(e),
    })?;

    // Hash da senha
    let hash = bcrypt::hash(&dto.password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::internal("Erro ao processar senha"))?;

    let user_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO users (id, workspace_id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, 'owner')
        "#,
        user_id, workspace_id, dto.name, dto.email, hash,
    )
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db) if db.constraint() == Some("users_workspace_id_email_key") =>
            AppError::conflict("Email já cadastrado"),
        _ => AppError::from(e),
    })?;

    let token = make_jwt(&state.jwt_secret, user_id, workspace_id, "owner")?;

    Ok((StatusCode::CREATED, Json(AuthResponse {
        token,
        user_id,
        workspace_id,
        name: dto.name,
        role: "owner".into(),
    })))
}

async fn login(
    State(state): State<AppState>,
    Json(dto): Json<LoginDto>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = sqlx::query!(
        r#"
        SELECT id, workspace_id, name, email, password_hash, role
        FROM users WHERE email = $1 AND is_active = true
        "#,
        dto.email,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::unauthorized("Email ou senha inválidos"))?;

    let valid = bcrypt::verify(&dto.password, &user.password_hash)
        .map_err(|_| AppError::internal("Erro de verificação"))?;

    if !valid {
        return Err(AppError::unauthorized("Email ou senha inválidos"));
    }

    // Atualiza last_login_at
    let _ = sqlx::query!(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1",
        user.id,
    )
    .execute(&state.db)
    .await;

    let token = make_jwt(&state.jwt_secret, user.id, user.workspace_id, &user.role)?;

    Ok(Json(AuthResponse {
        token,
        user_id:      user.id,
        workspace_id: user.workspace_id,
        name:         user.name,
        role:         user.role,
    }))
}

fn make_jwt(
    secret: &str,
    user_id: Uuid,
    workspace_id: Uuid,
    role: &str,
) -> Result<String, AppError> {
    let exp = (Utc::now() + chrono::Duration::days(30)).timestamp() as usize;
    let claims = Claims {
        sub:          user_id.to_string(),
        workspace_id: workspace_id.to_string(),
        role:         role.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::internal("Erro ao gerar token"))
}
