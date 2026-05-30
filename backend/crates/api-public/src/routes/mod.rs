//! Rotas da API Pública.
//!
//! Neste PR (mínimo compilável) apenas `usage` é montado — é o único endpoint
//! que não depende de `AuthUser`/FK de `users` nem de campos de `AppState` ainda
//! inexistentes (`http`/`llm`/`rag`) nem de schema não unificado.
//!
//! Os módulos abaixo permanecem como arquivos no crate e são reativados no PR de
//! enrichment (C2), que adiciona o service-user, enriquece o `AppState` e unifica
//! `webhook_endpoints`/`webhooks`.
pub mod usage;

// TODO(C2-enrichment): reativar após service-user + AppState (http/llm/rag) +
// unificação webhook_endpoints/webhooks.
// pub mod chat;
// pub mod search;
// pub mod projects;
// pub mod documents;
// pub mod training;
// pub mod webhooks;
