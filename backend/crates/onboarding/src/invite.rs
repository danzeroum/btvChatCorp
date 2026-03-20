use anyhow::Result;
use chrono::{Duration, Utc};
use rand::{distributions::Alphanumeric, Rng};
use sqlx::PgPool;
use uuid::Uuid;

/// Cria um convite de equipe para o workspace.
/// Retorna o token gerado que deve ser enviado por email.
pub async fn create_invite(
    pool: &PgPool,
    workspace_id: Uuid,
    email: &str,
    role: &str,
    invited_by: Uuid,
) -> Result<String> {
    let token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();

    let expires_at = Utc::now() + Duration::days(7);

    sqlx::query(
        r#"INSERT INTO workspace_invites
               (workspace_id, email, role, invite_token, invited_by, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (workspace_id, email)
           DO UPDATE SET
               invite_token = EXCLUDED.invite_token,
               status       = 'pending',
               expires_at   = EXCLUDED.expires_at,
               invited_by   = EXCLUDED.invited_by"#,
    )
    .bind(workspace_id)
    .bind(email)
    .bind(role)
    .bind(&token)
    .bind(invited_by)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(token)
}

/// Aceita um convite pelo token e retorna o workspace_id.
pub async fn accept_invite(pool: &PgPool, token: &str) -> Result<Uuid> {
    let row: (Uuid,) = sqlx::query_as(
        r#"UPDATE workspace_invites
           SET status = 'accepted', accepted_at = NOW()
           WHERE invite_token = $1
             AND status = 'pending'
             AND expires_at > NOW()
           RETURNING workspace_id"#,
    )
    .bind(token)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Expira convites vencidos (rodar periodicamente).
pub async fn expire_old_invites(pool: &PgPool) -> Result<u64> {
    let r = sqlx::query(
        "UPDATE workspace_invites SET status = 'expired'
         WHERE status = 'pending' AND expires_at < NOW()",
    )
    .execute(pool)
    .await?;
    Ok(r.rows_affected())
}
