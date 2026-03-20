use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub qdrant_url: String,
    pub embedding_url: String,
    pub storage_path: String,
    pub poll_interval_secs: u64,
    pub worker_concurrency: usize,
    pub max_retries: i32,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")?,
            qdrant_url: env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".into()),
            embedding_url: env::var("EMBEDDING_URL")
                .unwrap_or_else(|_| "http://localhost:8001".into()),
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "./uploads".into()),
            poll_interval_secs: env::var("POLL_INTERVAL_SECS")
                .unwrap_or_else(|_| "10".into())
                .parse()
                .unwrap_or(10),
            worker_concurrency: env::var("WORKER_CONCURRENCY")
                .unwrap_or_else(|_| "4".into())
                .parse()
                .unwrap_or(4),
            max_retries: env::var("MAX_RETRIES")
                .unwrap_or_else(|_| "3".into())
                .parse()
                .unwrap_or(3),
        })
    }
}
