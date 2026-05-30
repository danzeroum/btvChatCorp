//! Rotas da API Pública.
//!
//! Neste PR (mínimo compilável) apenas `usage` é montado — é o único endpoint
//! que não depende de `AuthUser`/FK de `users` nem de campos de `AppState` ainda
//! inexistentes (`http`/`llm`/`rag`) nem de schema não unificado.
//!
//! Os módulos abaixo permanecem como arquivos no crate e são reativados no PR de
//! enrichment (C2), que adiciona o service-user, enriquece o `AppState` e unifica
//! `webhook_endpoints`/`webhooks`.
pub mod chat;
pub mod search;
pub mod usage;
pub mod webhooks;

// TODO(C2-writes): reativar após service-user — estes delegam aos handlers vivos
// do crate `api`, que gravam created_by/uploaded_by/curator_id (FK users) e
// exigem um user_id válido sob API key.
// pub mod projects;
// pub mod documents;
// pub mod training;
