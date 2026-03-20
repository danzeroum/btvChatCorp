use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistStatus {
    pub branding_done: bool,
    pub first_project_done: bool,
    pub docs_uploaded: bool,
    pub chat_tested: bool,
    pub team_invited: bool,
    pub dismissed: bool,
    pub completed_count: u8,
    pub total: u8,
}

/// Calcula o status do checklist de onboarding para um workspace.
pub async fn get_checklist_status(pool: &PgPool, workspace_id: Uuid) -> Result<ChecklistStatus> {
    // Branding: tem logo?
    let branding_done: bool = sqlx::query_scalar(
        "SELECT logo_url IS NOT NULL FROM workspace_brandings WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(false);

    // Primeiro projeto
    let first_project_done: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM projects WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    // 5+ documentos
    let docs_uploaded: bool = sqlx::query_scalar(
        "SELECT COUNT(*) >= 5 FROM documents WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    // Chat testado (pelo menos 1 mensagem)
    let chat_tested: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM messages WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(false);

    // Equipe convidada (>= 1 convite aceito ou >= 2 usuários)
    let team_invited: bool = sqlx::query_scalar(
        "SELECT COUNT(*) >= 2 FROM users WHERE workspace_id = $1 AND is_active = true",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;

    // Checklist dispensado
    let dismissed: bool = sqlx::query_scalar(
        "SELECT checklist_dismissed FROM onboarding_progress WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(false);

    let items = [
        branding_done,
        first_project_done,
        docs_uploaded,
        chat_tested,
        team_invited,
    ];
    let completed_count = items.iter().filter(|&&v| v).count() as u8;

    Ok(ChecklistStatus {
        branding_done,
        first_project_done,
        docs_uploaded,
        chat_tested,
        team_invited,
        dismissed,
        completed_count,
        total: items.len() as u8,
    })
}

/// Marca o checklist como dispensado.
pub async fn dismiss_checklist(pool: &PgPool, workspace_id: Uuid) -> Result<()> {
    sqlx::query(
        "UPDATE onboarding_progress SET checklist_dismissed = true WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}
