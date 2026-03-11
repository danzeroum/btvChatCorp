use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::extractors::{WorkspaceContext, Permission, ModelConfig};

/// Claims do JWT gerado no login
#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,          // user_id
    pub workspace_id: String,
    pub role: String,
    pub email: String,
    pub name: String,
    pub exp: usize,
    pub iat: usize,
}

/// Middleware que valida o JWT, carrega permissões do usuário
/// e injeta o `WorkspaceContext` nas extensions do request.
pub async fn jwt_auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extrai o token do header Authorization: Bearer <token>
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // TODO: buscar jwt_secret do AppState — por ora usa env var
    let secret = std::env::var("JWT_SECRET").unwrap_or_default();

    let token_data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let claims = token_data.claims;

    // Monta o WorkspaceContext com os dados do token
    // Permissões detalhadas são carregadas via DB em request (pode ser cacheado via Redis)
    let ctx = WorkspaceContext {
        user_id: Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?,
        workspace_id: Uuid::parse_str(&claims.workspace_id).map_err(|_| StatusCode::UNAUTHORIZED)?,
        user_name: claims.name,
        user_email: claims.email,
        role: claims.role.clone(),
        permissions: role_to_permissions(&claims.role),
        model_config: ModelConfig {
            version: "llama-3.3-70b".into(),
            lora_path: None,
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 0.9,
        },
        company_name: String::new(), // carregado lazy do DB
        sector: String::new(),
        preferred_tone: None,
        language: Some("pt-BR".into()),
        custom_system_prompt: None,
        auto_anonymize: false,
        sensitive_keywords: vec![],
    };

    // Injeta o contexto nas extensions para os handlers acessarem
    request.extensions_mut().insert(ctx);

    Ok(next.run(request).await)
}

/// Converte role string em lista de permissões padrão
fn role_to_permissions(role: &str) -> Vec<Permission> {
    match role {
        "Admin" => vec![
            Permission { resource: "workspace".into(), actions: vec!["view".into(), "create".into(), "edit".into(), "delete".into(), "manage".into()] },
            Permission { resource: "users".into(),     actions: vec!["view".into(), "create".into(), "edit".into(), "delete".into(), "manage".into()] },
            Permission { resource: "documents".into(), actions: vec!["view".into(), "create".into(), "edit".into(), "delete".into()] },
            Permission { resource: "chats".into(),     actions: vec!["view".into(), "create".into(), "edit".into(), "delete".into()] },
            Permission { resource: "ai_config".into(), actions: vec!["view".into(), "edit".into(), "manage".into()] },
            Permission { resource: "billing".into(),   actions: vec!["view".into(), "manage".into()] },
            Permission { resource: "audit_logs".into(),actions: vec!["view".into()] },
            Permission { resource: "api_keys".into(),  actions: vec!["view".into(), "create".into(), "delete".into()] },
        ],
        "Analyst" => vec![
            Permission { resource: "workspace".into(), actions: vec!["view".into()] },
            Permission { resource: "documents".into(), actions: vec!["view".into(), "create".into()] },
            Permission { resource: "chats".into(),     actions: vec!["view".into(), "create".into()] },
            Permission { resource: "training_data".into(), actions: vec!["view".into(), "approve".into()] },
        ],
        "Viewer" => vec![
            Permission { resource: "workspace".into(), actions: vec!["view".into()] },
            Permission { resource: "documents".into(), actions: vec!["view".into()] },
            Permission { resource: "chats".into(),     actions: vec!["view".into(), "create".into()] },
        ],
        _ => vec![
            Permission { resource: "chats".into(), actions: vec!["view".into(), "create".into()] },
        ],
    }
}
