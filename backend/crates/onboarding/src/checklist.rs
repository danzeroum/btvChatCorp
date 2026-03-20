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
    pub completed_count: i32,
    pub total: i32,
    pub items: serde_json::Value,
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
    let first_project_done: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE workspace_id = $1")
            .bind(workspace_id)
            .fetch_one(pool)
            .await?;

    // 5+ documentos
    let docs_uploaded: bool =
        sqlx::query_scalar("SELECT COUNT(*) >= 5 FROM documents WHERE workspace_id = $1")
            .bind(workspace_id)
            .fetch_one(pool)
            .await?;

    // Chat testado (pelo menos 1 mensagem)
    let chat_tested: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM messages WHERE workspace_id = $1")
            .bind(workspace_id)
            .fetch_optional(pool)
            .await?
            .unwrap_or(false);

    // Equipe convidada (>= 2 usuarios ativos)
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

    let flags = [
        branding_done,
        first_project_done,
        docs_uploaded,
        chat_tested,
        team_invited,
    ];
    let completed_count = flags.iter().filter(|&&v| v).count() as i32;
    let total = flags.len() as i32;

    let items = serde_json::json!([
        { "id": "branding",       "completed": branding_done },
        { "id": "first_project",  "completed": first_project_done },
        { "id": "docs_uploaded",  "completed": docs_uploaded },
        { "id": "chat_tested",    "completed": chat_tested },
        { "id": "team_invited",   "completed": team_invited },
    ]);

    Ok(ChecklistStatus {
        branding_done,
        first_project_done,
        docs_uploaded,
        chat_tested,
        team_invited,
        dismissed,
        completed_count,
        total,
        items,
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
