//! Biblioteca do crate `api`.
//!
//! Historicamente o projeto usava apenas `main.rs` como entry point, mas o
//! crate `api-public` precisa reutilizar `state`, `routes`, `security` e
//! `middleware` por delegação. Esta lib expõe esses módulos; `main.rs` passa a
//! ser um shim fino que constrói e sobe o servidor a partir daqui.

pub mod errors;
pub mod extractors;
pub mod middleware;
pub mod models;
pub mod rag;
pub mod routes;
pub mod security;
pub mod services;
pub mod state;

#[cfg(test)]
mod rag_test;
#[cfg(test)]
mod test_helpers;
