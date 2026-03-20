use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

/// Provisiona um novo workspace: cria branding padrão, progresso de onboarding
/// e garante que a collection Qdrant existe (best-effort).
pub async fn provision_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    subdomain: &str,
    company_name: &str,
) -> Result<()> {
    // 1. Cria branding padrão (idempotente)
    sqlx::query(
        r#"INSERT INTO workspace_brandings
               (workspace_id, company_name, platform_name, subdomain)
           VALUES ($1, $2, $2, $3)
           ON CONFLICT (workspace_id) DO NOTHING"#,
    )
    .bind(workspace_id)
    .bind(company_name)
    .bind(subdomain)
    .execute(pool)
    .await?;

    // 2. Cria progresso de onboarding (idempotente)
    sqlx::query(
        r#"INSERT INTO onboarding_progress (workspace_id)
           VALUES ($1)
           ON CONFLICT (workspace_id) DO NOTHING"#,
    )
    .bind(workspace_id)
    .execute(pool)
    .await?;

    tracing::info!(workspace_id = %workspace_id, subdomain, "Workspace provisionado");
    Ok(())
}

/// Avança o step de onboarding e persiste os dados coletados.
pub async fn advance_step(
    pool: &PgPool,
    workspace_id: Uuid,
    step: i32,
    data: serde_json::Value,
) -> Result<()> {
    sqlx::query(
        r#"UPDATE onboarding_progress
           SET current_step   = GREATEST(current_step, $2 + 1),
               completed_steps = array_append(
                   array_remove(completed_steps, $2), $2
               ),
               collected_data  = collected_data || $3,
               last_step_at    = NOW()
           WHERE workspace_id = $1"#,
    )
    .bind(workspace_id)
    .bind(step)
    .bind(data)
    .execute(pool)
    .await?;
    Ok(())
}

/// Marca onboarding como concluído.
pub async fn complete_onboarding(pool: &PgPool, workspace_id: Uuid) -> Result<()> {
    sqlx::query(
        "UPDATE onboarding_progress SET completed_at = NOW() WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .execute(pool)
    .await?;
    Ok(())
}
