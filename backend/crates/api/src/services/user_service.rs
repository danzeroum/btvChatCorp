//! UserService: CRUD de usuários, roles, sessions.
//!
//! Sprint 2 — Grupo B.

use sqlx::PgPool;
use uuid::Uuid;
use anyhow::Result;

use crate::models::admin::*;

#[derive(Clone)]
pub struct UserService {
    pub db: PgPool,
}

impl UserService {
    pub fn new(db: PgPool) -> Self { Self { db } }

    // ── Users ────────────────────────────────────────────────────────────────

    pub async fn list_users(&self) -> Result<Vec<WorkspaceUserRow>> {
        Ok(sqlx::query_as::<_, WorkspaceUserRow>(
            r#"SELECT u.id, u.email, u.name,
                      COALESCE(r.name, 'member') AS role_name,
                      u.status, u.mfa_enabled,
                      u.last_login_at, u.last_login_ip, u.created_at
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
               ORDER BY u.created_at DESC"""
        ).fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn get_user(&self, id: Uuid) -> Result<WorkspaceUserRow> {
        Ok(sqlx::query_as::<_, WorkspaceUserRow>(
            r#"SELECT u.id, u.email, u.name,
                      COALESCE(r.name, 'member') AS role_name,
                      u.status, u.mfa_enabled,
                      u.last_login_at, u.last_login_ip, u.created_at
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
               WHERE u.id = $1"""
        ).bind(id).fetch_one(&self.db).await?)
    }

    pub async fn invite_user(
        &self, email: &str, role_id: &str, project_ids: &[Uuid],
    ) -> Result<()> {
        let user_id = Uuid::new_v4();
        sqlx::query(
            r#"INSERT INTO users (id, email, name, role_id, status, mfa_enabled, created_at)
               VALUES ($1, $2, $2, $3::uuid, 'invited', false, NOW())
               ON CONFLICT (email) DO NOTHING"""
        ).bind(user_id).bind(email).bind(role_id).execute(&self.db).await?;
        for pid in project_ids {
            sqlx::query(
                "INSERT INTO project_members (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
            ).bind(user_id).bind(pid).execute(&self.db).await.ok();
        }
        // TODO: enviar e-mail de convite via notification service
        Ok(())
    }

    pub async fn update_user(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        if let Some(name) = body["name"].as_str() {
            sqlx::query("UPDATE users SET name=$1 WHERE id=$2")
                .bind(name).bind(id).execute(&self.db).await?;
        }
        if let Some(role_id) = body["role_id"].as_str() {
            sqlx::query("UPDATE users SET role_id=$1::uuid WHERE id=$2")
                .bind(role_id).bind(id).execute(&self.db).await?;
        }
        Ok(())
    }

    pub async fn set_user_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query("UPDATE users SET status=$1 WHERE id=$2")
            .bind(status).bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn export_users_csv(&self) -> Result<String> {
        let users = self.list_users().await?;
        let mut csv = "id,email,name,role,status,mfa_enabled,created_at\n".to_string();
        for u in users {
            csv.push_str(&format!("{},{},{},{},{},{},{}\n",
                u.id, u.email, u.name, u.role_name, u.status, u.mfa_enabled, u.created_at));
        }
        Ok(csv)
    }

    // ── Roles ────────────────────────────────────────────────────────────────

    pub async fn list_roles(&self) -> Result<Vec<RoleRow>> {
        Ok(sqlx::query_as::<_, RoleRow>(
            r#"SELECT r.id, r.name, r.description, r.is_system, r.permissions,
                      COUNT(u.id) AS user_count
               FROM roles r
               LEFT JOIN users u ON u.role_id = r.id
               GROUP BY r.id ORDER BY r.is_system DESC, r.name"""
        ).fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn create_role(&self, body: serde_json::Value) -> Result<RoleRow> {
        Ok(sqlx::query_as::<_, RoleRow>(
            r#"INSERT INTO roles (id, name, description, is_system, permissions)
               VALUES (gen_random_uuid(), $1, $2, false, $3) RETURNING
               id, name, description, is_system, permissions, 0::bigint AS user_count"""
        )
        .bind(body["name"].as_str().unwrap_or(""))
        .bind(body["description"].as_str().unwrap_or(""))
        .bind(body.get("permissions").cloned().unwrap_or(serde_json::json!([])))
        .fetch_one(&self.db).await?)
    }

    pub async fn update_role(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query(
            "UPDATE roles SET name=$1, description=$2, permissions=$3 WHERE id=$4 AND is_system=false"
        )
        .bind(body["name"].as_str().unwrap_or(""))
        .bind(body["description"].as_str().unwrap_or(""))
        .bind(body.get("permissions").cloned().unwrap_or_default())
        .bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_role(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE id=$1 AND is_system=false")
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Sessions ─────────────────────────────────────────────────────────────

    pub async fn list_active_sessions(&self) -> Result<Vec<SessionRow>> {
        Ok(sqlx::query_as::<_, SessionRow>(
            r#"SELECT s.id, s.user_id, u.name AS user_name, u.email AS user_email,
                      s.ip_address, s.user_agent, s.created_at, s.expires_at
               FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.expires_at > NOW()
               ORDER BY s.created_at DESC"""
        ).fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn terminate_session(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE id=$1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn terminate_all_sessions(&self, except_id: Uuid) -> Result<i64> {
        let result = sqlx::query(
            "DELETE FROM sessions WHERE id <> $1"
        ).bind(except_id).execute(&self.db).await?;
        Ok(result.rows_affected() as i64)
    }
}
