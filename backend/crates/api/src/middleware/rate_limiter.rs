use std::{
    collections::HashMap,
    num::NonZeroU32,
    sync::Arc,
};
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use governor::{Quota, RateLimiter, clock::DefaultClock, state::{InMemoryState, NotKeyed}, middleware::NoOpMiddleware};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::middleware::api_key_auth::ApiKeyContext;

type GovLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>>;

/// Rate limiter por API Key — cada key pode ter limite próprio (rpm)
#[derive(Clone)]
pub struct PerKeyRateLimiter {
    limiters: Arc<RwLock<HashMap<Uuid, GovLimiter>>>,
    default_rpm: u32,
}

impl PerKeyRateLimiter {
    pub fn new(default_rpm: u32) -> Self {
        Self {
            limiters: Arc::new(RwLock::new(HashMap::new())),
            default_rpm,
        }
    }

    pub async fn check(&self, ctx: &ApiKeyContext) -> Result<(), StatusCode> {
        let rpm = ctx.rate_limit_rpm.max(1);
        let key_id = ctx.key_id;

        // Busca limiter existente
        {
            let read = self.limiters.read().await;
            if let Some(limiter) = read.get(&key_id) {
                return limiter.check().map_err(|_| StatusCode::TOO_MANY_REQUESTS);
            }
        }

        // Cria novo limiter para esta key
        let quota = Quota::per_minute(NonZeroU32::new(rpm).unwrap());
        let limiter: GovLimiter = Arc::new(RateLimiter::direct(quota));
        self.limiters.write().await.insert(key_id, limiter.clone());
        limiter.check().map_err(|_| StatusCode::TOO_MANY_REQUESTS)
    }
}
