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
pub mod projects;
pub mod search;
pub mod usage;
pub mod webhooks;

// `projects` reativado (C2-writes): grava `created_by` a partir do dono da API
// key (`api_keys.created_by` → `ApiKeyContext.user_id`).
//
// TODO(C2-writes): `documents`/`training` ainda dependem de
// uploaded_by/curator_id (FK users) e seguem desativados até o mesmo tratamento.
// pub mod documents;
// pub mod training;
