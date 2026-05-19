//! Modelos de dominio compartilhados entre rotas.
//!
//! Cada submodulo espelha uma entidade de banco de dados.
//! Re-exports publicos sao listados abaixo para facilitar
//! `use crate::models::*` nas rotas.

pub mod chat;
pub mod project;
pub mod user;
pub mod workspace;
