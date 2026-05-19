//! Camada de serviços do crate `api`.
//!
//! Sprint 2 — Grupo B:
//! - `admin_service`  — health, metrics, AI config, API keys, webhooks, settings
//! - `user_service`   — lógica de negócio de usuários, roles e sessions
//! - `audit_service`  — audit logs, compliance e retention policies

pub mod admin_service;
pub mod user_service;
pub mod audit_service;

pub use admin_service::AdminService;
pub use user_service::UserService;
pub use audit_service::AuditService;
