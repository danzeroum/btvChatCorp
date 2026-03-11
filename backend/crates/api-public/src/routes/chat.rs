// Endpoints de chat compatíveis com formato OpenAI
// Delega a lógica ao crate `api` interno (evita duplicação)
// A API Pública adiciona: autenticação por API key, rate limiting, uso tracking e Swagger

pub use crate_api::routes::chat::chat_routes;
