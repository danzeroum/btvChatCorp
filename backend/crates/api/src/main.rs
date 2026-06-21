use std::env;

use axum::extract::Request;
use axum::http::{header, HeaderValue, Method};
use axum::routing::get;
use axum::{Json, Router, ServiceExt};
use tower::Layer;
use tower_http::cors::CorsLayer;
use tower_http::normalize_path::NormalizePathLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use std::sync::Arc;

use api::routes;
use api::services::admin_service::AdminService;
use api::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("api=debug".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL obrigatorio");
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("../../migrations").run(&db).await?;
    tracing::info!("Migrations OK");

    let ollama_url =
        env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".into());
    let ollama_model = env::var("OLLAMA_MODEL").unwrap_or_else(|_| "mistral:latest".into());
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET obrigatorio");
    let api_key_hmac_secret =
        env::var("API_KEY_HMAC_SECRET").expect("API_KEY_HMAC_SECRET obrigatorio");
    // BH-04: falha rapida no startup se o token de servicos internos estiver ausente.
    // Preferimos panicar aqui (servidor nao sobe) a operar RAG sem autenticacao
    // entre servicos. Os handlers leem a var em tempo de request com degradacao
    // graciosa, ja garantida presente quando o servidor esta no ar.
    let _internal_service_token = env::var("INTERNAL_SERVICE_TOKEN")
        .expect("INTERNAL_SERVICE_TOKEN obrigatorio para comunicacao com servicos internos");
    let ollama_auth = match env::var("OLLAMA_AUTH_USER").ok() {
        Some(u) => {
            let p = env::var("OLLAMA_AUTH_PASS").unwrap_or_default();
            Some(format!("{}:{}", u, p))
        }
        None => None,
    };

    let qdrant_url = env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".into());
    let embedding_url =
        env::var("EMBEDDING_URL").unwrap_or_else(|_| "http://localhost:8001".into());

    // Redis para o throttle de login distribuido (scale-safe). Best-effort: se
    // REDIS_URL estiver ausente/indisponivel, cai para o throttle em memoria.
    let redis_conn = match env::var("REDIS_URL") {
        Ok(url) if !url.is_empty() => match redis::Client::open(url) {
            Ok(client) => match redis::aio::ConnectionManager::new(client).await {
                Ok(cm) => {
                    tracing::info!("Redis conectado — throttle de login distribuido");
                    Some(cm)
                }
                Err(e) => {
                    tracing::warn!("Redis indisponivel ({e}); throttle de login em memoria");
                    None
                }
            },
            Err(e) => {
                tracing::warn!("REDIS_URL invalida ({e}); throttle de login em memoria");
                None
            }
        },
        _ => {
            tracing::info!("REDIS_URL nao definido; throttle de login em memoria");
            None
        }
    };
    let login_throttle = api::throttle::LoginThrottle::new(redis_conn);

    tracing::info!(
        "LLM={} | Qdrant={} | Embedding={}",
        ollama_url,
        qdrant_url,
        embedding_url
    );

    let admin_service = Arc::new(AdminService::new(
        db.clone(),
        ollama_url.clone(),
        qdrant_url.clone(),
        embedding_url.clone(),
    ));

    // Webhooks: dispatcher fire-and-forget com worker em background (HTTP + retry).
    let webhook_dispatcher =
        webhooks::WebhookDispatcher::new(webhooks::WebhookStore::new(db.clone()));

    let state = AppState {
        db,
        ollama_url,
        ollama_model,
        ollama_auth,
        jwt_secret: jwt_secret.into(),
        api_key_hmac_secret: api_key_hmac_secret.into(),
        qdrant_url,
        embedding_url,
        admin_service,
        login_throttle,
        webhooks: webhook_dispatcher,
    };

    // Origens permitidas vêm de ALLOWED_ORIGINS (CSV); default: dev local Angular.
    let allowed_origins: Vec<HeaderValue> = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:4200".into())
        .split(',')
        .filter_map(|s| s.trim().parse::<HeaderValue>().ok())
        .collect();
    tracing::info!("CORS allowed origins: {:?}", allowed_origins);

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true);

    let app = Router::new()
        .route(
            "/health",
            get(async || Json(serde_json::json!({ "status": "ok" }))),
        )
        .nest("/api/v1", routes::v1_routes(state.clone()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Normaliza a barra final antes do roteamento: `/api/v1/projects/` casa com
    // a rota `/api/v1/projects`. Axum 0.7 removeu o redirect automatico de
    // trailing slash, e o frontend chama varias colecoes com barra no final.
    let app = NormalizePathLayer::trim_trailing_slash().layer(app);

    let addr = "0.0.0.0:3000";
    tracing::info!("API escutando em {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, ServiceExt::<Request>::into_make_service(app)).await?;
    Ok(())
}
