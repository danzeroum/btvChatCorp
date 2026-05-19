//! Handlers do programa de parceiros BTV.
//!
//! Rotas:
//!   POST /partner/signup          — auto-onboarding de novo parceiro
//!   GET  /partner/workspaces      — lista workspaces do parceiro
//!   POST /partner/workspaces      — criar workspace white-label
//!   GET  /partner/workspaces/:id  — detalhes do workspace
//!   GET  /partner/usage           — uso e custos agregados

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::state::AppState;

// ---- DTOs ----

#[derive(Debug, Deserialize, ToSchema)]
pub struct PartnerSignupRequest {
    /// Nome da empresa parceira
    pub company_name: String,
    /// Email do responsavel tecnico
    pub email: String,
    /// Senha (minimo 12 caracteres)
    pub password: String,
    /// CNPJ da empresa (14 digitos, sem formatacao)
    pub cnpj: String,
    /// Plano inicial: "starter", "growth", "enterprise"
    pub plan: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PartnerSignupResponse {
    pub partner_id: Uuid,
    pub api_key: String,
    pub message: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWorkspaceRequest {
    /// Nome do workspace (nome do cliente do parceiro)
    pub name: String,
    /// Subdominio desejado (ex: "empresa" -> empresa.btvc.com)
    pub subdomain: String,
    /// Cor primaria da marca (#RRGGBB)
    pub primary_color: Option<String>,
    /// Logo URL
    pub logo_url: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkspaceResponse {
    pub workspace_id: Uuid,
    pub name: String,
    pub subdomain: String,
    pub url: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UsageResponse {
    pub period: String,
    pub total_messages: i64,
    pub total_documents: i64,
    pub total_tokens: i64,
    pub estimated_cost_brl: f64,
    pub workspaces: Vec<WorkspaceUsage>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkspaceUsage {
    pub workspace_id: Uuid,
    pub name: String,
    pub messages: i64,
    pub tokens: i64,
}

// ---- Handlers ----

/// Auto-onboarding de novo parceiro BTV.
///
/// Cria conta de parceiro, gera API key inicial e retorna credenciais.
/// O parceiro recebe um email de confirmacao com instrucoes de acesso.
pub async fn signup(
    State(state): State<AppState>,
    Json(req): Json<PartnerSignupRequest>,
) -> Result<Json<PartnerSignupResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Validar CNPJ (14 digitos)
    if req.cnpj.chars().filter(|c| c.is_ascii_digit()).count() != 14 {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "CNPJ invalido" })),
        ));
    }

    // Validar plano
    if !["starter", "growth", "enterprise"].contains(&req.plan.as_str()) {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "Plano invalido. Use: starter, growth ou enterprise" })),
        ));
    }

    let partner_id = Uuid::new_v4();
    // Gera API key inicial: btv_<uuid_sem_hifens>
    let raw_key = format!("btv_{}", Uuid::new_v4().to_string().replace('-', ""));

    // Persiste no banco
    sqlx::query!(
        r#"
        INSERT INTO partners (id, company_name, email, cnpj, plan, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        "#,
        partner_id,
        req.company_name,
        req.email,
        req.cnpj,
        req.plan,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": format!("Erro ao criar parceiro: {}", e) })),
    ))?;

    // Persiste API key (hash SHA-256 no banco, raw apenas no retorno)
    use sha2::{Digest, Sha256};
    let key_hash = format!("{:x}", Sha256::digest(raw_key.as_bytes()));
    sqlx::query!(
        "INSERT INTO api_keys (id, partner_id, key_hash, descricao, ativa, created_at) VALUES ($1, $2, $3, 'Chave inicial', true, NOW())",
        Uuid::new_v4(),
        partner_id,
        key_hash,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": format!("Erro ao criar API key: {}", e) })),
    ))?;

    Ok(Json(PartnerSignupResponse {
        partner_id,
        api_key: raw_key,
        message: format!(
            "Parceiro criado com sucesso. Guarde sua API key — ela nao sera exibida novamente."
        ),
    }))
}

/// Lista workspaces white-label do parceiro autenticado.
pub async fn list_workspaces(
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: extrair partner_id do JWT
    let rows = sqlx::query!(
        "SELECT id, name, subdomain, status, created_at FROM workspaces LIMIT 100"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": e.to_string() })),
    ))?;

    let workspaces = rows.into_iter().map(|r| WorkspaceResponse {
        workspace_id: r.id,
        name: r.name,
        subdomain: r.subdomain.clone().unwrap_or_default(),
        url: format!("https://{}.btvc.com", r.subdomain.unwrap_or_default()),
        status: r.status.unwrap_or_else(|| "active".to_string()),
        created_at: r.created_at,
    }).collect();

    Ok(Json(workspaces))
}

/// Cria workspace white-label para cliente do parceiro.
pub async fn create_workspace(
    State(state): State<AppState>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, (StatusCode, Json<serde_json::Value>)> {
    let workspace_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query!(
        r#"
        INSERT INTO workspaces (id, name, subdomain, status, created_at)
        VALUES ($1, $2, $3, 'provisioning', $4)
        "#,
        workspace_id,
        req.name,
        req.subdomain,
        now,
    )
    .execute(&state.db)
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": e.to_string() })),
    ))?;

    Ok(Json(WorkspaceResponse {
        workspace_id,
        name: req.name,
        subdomain: req.subdomain.clone(),
        url: format!("https://{}.btvc.com", req.subdomain),
        status: "provisioning".to_string(),
        created_at: now,
    }))
}
