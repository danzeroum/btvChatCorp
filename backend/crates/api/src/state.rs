//! AppState da aplicação — Sprint 2 (Grupo B).
//!
//! admin_service foi decomposto em três serviços com responsabilidade única:
//! - AdminService  — health, metrics, AI, API keys, webhooks, settings, branding
//! - UserService   — usuários, roles, sessions
//! - AuditService  — audit logs, compliance, retention

use sqlx::PgPool;
use crate::services::{AdminService, UserService, AuditService};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub ollama_url: String,
    pub ollama_model: String,
    /// Basic auth no formato "user:pass" — None para Ollama local sem auth
    pub ollama_auth: Option<String>,
    pub jwt_secret: String,
    /// URL do Qdrant (ex: http://localhost:6333)
    pub qdrant_url: String,
    /// URL do serviço de embedding Python (ex: http://localhost:8001)
    pub embedding_url: String,

    // ── Serviços (Sprint 2) ──────────────────────────────────────────────────
    /// B-1: health, metrics, AI config, API keys, webhooks, settings, branding
    pub admin_service: AdminService,
    /// B-2: usuários, roles, sessions
    pub user_service: UserService,
    /// B-3: audit logs, compliance, retention policies
    pub audit_service: AuditService,
}

impl AppState {
    pub fn new(
        db: PgPool,
        ollama_url: String,
        ollama_model: String,
        ollama_auth: Option<String>,
        jwt_secret: String,
        qdrant_url: String,
        embedding_url: String,
    ) -> Self {
        let admin_service = AdminService::new(
            db.clone(), ollama_url.clone(), qdrant_url.clone(), embedding_url.clone(),
        );
        let user_service  = UserService::new(db.clone());
        let audit_service = AuditService::new(db.clone());
        Self {
            db, ollama_url, ollama_model, ollama_auth, jwt_secret,
            qdrant_url, embedding_url,
            admin_service, user_service, audit_service,
        }
    }
}
