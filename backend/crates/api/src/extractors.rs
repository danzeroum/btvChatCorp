//! Extractors customizados do Axum.
//!
//! Por ora apenas re-exporta `Claims` do middleware de auth
//! para uso nas rotas via `use crate::extractors::Claims`.

pub use crate::middleware::auth::Claims;
