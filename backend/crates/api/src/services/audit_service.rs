//! AuditService: audit logs, compliance report, retention policies.
//!
//! Sprint 2 — Grupo B.

use sqlx::PgPool;
use anyhow::Result;

use crate::models::admin::*;

#[derive(Clone)]
pub struct AuditService {
    pub db: PgPool,
}

impl AuditService {
    pub fn new(db: PgPool) -> Self { Self { db } }

    pub async fn query_audit_logs(&self, filters: AuditFiltersQuery) -> Result<AuditPage> {
        let page     = filters.page.unwrap_or(1).max(1);
        let per_page = filters.per_page.unwrap_or(50).min(200);
        let offset   = (page - 1) * per_page;

        // Contagem total
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs")
            .fetch_one(&self.db).await.unwrap_or(0);

        let entries = sqlx::query_as::<_, AuditLogRow>(
            r#"SELECT id, created_at, user_id, user_name, user_ip, action,
                      resource_name, severity, category, details
               FROM audit_logs
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2"""
        ).bind(per_page).bind(offset)
            .fetch_all(&self.db).await.unwrap_or_default();

        Ok(AuditPage { entries, total, page, per_page })
    }

    pub async fn export_audit_csv(&self, filters: AuditFiltersQuery) -> Result<String> {
        let page = self.query_audit_logs(filters).await?;
        let mut csv = "id,created_at,user_name,action,resource_name,severity,category\n".to_string();
        for e in page.entries {
            csv.push_str(&format!("{},{},{},{},{},{},{}\n",
                e.id, e.created_at, e.user_name, e.action,
                e.resource_name, e.severity, e.category));
        }
        Ok(csv)
    }

    pub async fn generate_compliance_report(&self) -> Result<ComplianceReport> {
        let stats = sqlx::query_as::<_, AccessStats>(
            r#"SELECT
                COUNT(*)                        AS total_users,
                COUNT(*) FILTER (WHERE mfa_enabled) AS mfa_enabled,
                ROUND(COUNT(*) FILTER (WHERE mfa_enabled)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS mfa_percent,
                0::bigint                       AS failed_logins,
                0::bigint                       AS access_denied
               FROM users"""
        ).fetch_one(&self.db).await.unwrap_or(AccessStats {
            total_users: 0, mfa_enabled: 0, mfa_percent: 0.0,
            failed_logins: 0, access_denied: 0,
        });
        Ok(ComplianceReport {
            generated_at: chrono::Utc::now().to_rfc3339(),
            overall_score: if stats.mfa_percent >= 80.0 { 90 } else { 60 },
            access_stats: stats,
        })
    }

    // ── Retention ─────────────────────────────────────────────────────────────

    pub async fn get_retention_policies(&self) -> Result<Vec<RetentionPolicy>> {
        Ok(sqlx::query_as::<_, RetentionPolicy>(
            "SELECT * FROM retention_policies ORDER BY data_type"
        ).fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn update_retention_policies(&self, policies: Vec<RetentionPolicy>) -> Result<()> {
        for p in policies {
            sqlx::query(
                r#"UPDATE retention_policies
                   SET retention_days=$1, auto_delete_enabled=$2
                   WHERE data_type=$3"""
            ).bind(p.retention_days).bind(p.auto_delete_enabled)
             .bind(&p.data_type).execute(&self.db).await.ok();
        }
        Ok(())
    }

    pub async fn manual_purge(&self, data_type: &str) -> Result<i64> {
        let policy = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT retention_days FROM retention_policies WHERE data_type=$1"
        ).bind(data_type).fetch_optional(&self.db).await.unwrap_or(None);

        let days = policy.flatten().unwrap_or(90);
        let result = match data_type {
            "chat_messages" => sqlx::query(
                "DELETE FROM messages WHERE created_at < NOW() - ($1 || ' days')::interval"
            ).bind(days).execute(&self.db).await,
            "audit_logs" => sqlx::query(
                "DELETE FROM audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval"
            ).bind(days).execute(&self.db).await,
            _ => return Ok(0),
        };
        Ok(result.map(|r| r.rows_affected() as i64).unwrap_or(0))
    }

    pub async fn list_deletion_requests(&self) -> Result<Vec<DeletionRequest>> {
        Ok(sqlx::query_as::<_, DeletionRequest>(
            "SELECT * FROM deletion_requests ORDER BY requested_at DESC"
        ).fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn create_deletion_request(&self, target_name: &str, r#type: &str) -> Result<()> {
        sqlx::query(
            r#"INSERT INTO deletion_requests (id, type, requested_by, target_name, status, requested_at)
               VALUES (gen_random_uuid(), $1, 'admin', $2, 'pending', NOW())"""
        ).bind(r#type).bind(target_name).execute(&self.db).await?;
        Ok(())
    }
}
