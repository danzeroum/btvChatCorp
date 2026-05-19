use sqlx::PgPool;

use crate::config::GatewayConfig;

#[derive(Clone, Debug)]
pub struct GatewayState {
    pub db: PgPool,
    pub http: reqwest::Client,
    pub config: GatewayConfig,
}

impl GatewayState {
    pub async fn new(cfg: &GatewayConfig) -> Self {
        let db = PgPool::connect(&cfg.database_url)
            .await
            .expect("Falha ao conectar ao PostgreSQL");
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("Falha ao criar cliente HTTP");
        Self {
            db,
            http,
            config: cfg.clone(),
        }
    }
}
