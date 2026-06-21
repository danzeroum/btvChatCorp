//! Throttle de tentativas de login por IP.
//!
//! Backend **Redis** (distribuido, scale-safe — varias replicas da API
//! compartilham o contador) com **fallback em memoria** (DashMap) quando o
//! Redis nao esta configurado/indisponivel. Janela fixa: `LOGIN_MAX_ATTEMPTS`
//! falhas dentro de `LOGIN_WINDOW_SECS` resultam em bloqueio (HTTP 429).
//!
//! Politica em erro de Redis: *fail-open* (nao bloqueia) — preferimos nao
//! travar usuarios legitimos por um hiccup de cache; o nginx ja faz rate-limit
//! por IP na borda como segunda camada.

use std::sync::Arc;
use std::time::Instant;

use dashmap::DashMap;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;

pub const LOGIN_MAX_ATTEMPTS: u32 = 5;
pub const LOGIN_WINDOW_SECS: u64 = 900; // 15 minutos

/// Throttle de login. Clonavel e barato (Arc/ConnectionManager internamente).
#[derive(Clone)]
pub struct LoginThrottle {
    redis: Option<ConnectionManager>,
    /// Fallback em memoria: ip -> (falhas, instante_da_primeira_falha).
    mem: Arc<DashMap<String, (u32, Instant)>>,
}

impl LoginThrottle {
    pub fn new(redis: Option<ConnectionManager>) -> Self {
        Self {
            redis,
            mem: Arc::new(DashMap::new()),
        }
    }

    fn key(ip: &str) -> String {
        format!("login_fail:{ip}")
    }

    /// `true` se o IP excedeu o limite de tentativas na janela atual.
    pub async fn is_blocked(&self, ip: &str) -> bool {
        if let Some(cm) = &self.redis {
            let mut cm = cm.clone();
            let count: u32 = cm.get(Self::key(ip)).await.unwrap_or(0);
            return count >= LOGIN_MAX_ATTEMPTS;
        }
        if let Some(entry) = self.mem.get(ip) {
            let (count, since) = *entry;
            if since.elapsed().as_secs() < LOGIN_WINDOW_SECS {
                return count >= LOGIN_MAX_ATTEMPTS;
            }
        }
        false
    }

    /// Registra uma falha de login para o IP (incrementa o contador da janela).
    pub async fn record_failure(&self, ip: &str) {
        if let Some(cm) = &self.redis {
            let mut cm = cm.clone();
            let key = Self::key(ip);
            // INCR e, na primeira falha da janela, define o TTL (janela fixa).
            let n: u32 = cm.incr(&key, 1u32).await.unwrap_or(0);
            if n == 1 {
                let _: redis::RedisResult<bool> = cm.expire(&key, LOGIN_WINDOW_SECS as i64).await;
            }
            return;
        }
        let now = Instant::now();
        let mut entry = self.mem.entry(ip.to_string()).or_insert((0, now));
        let (count, since) = *entry;
        if since.elapsed().as_secs() >= LOGIN_WINDOW_SECS {
            *entry = (1, now);
        } else {
            *entry = (count + 1, since);
        }
    }

    /// Zera o contador do IP (login bem-sucedido).
    pub async fn clear(&self, ip: &str) {
        if let Some(cm) = &self.redis {
            let mut cm = cm.clone();
            let _: redis::RedisResult<u32> = cm.del(Self::key(ip)).await;
            return;
        }
        self.mem.remove(ip);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn memory_throttle_blocks_after_max_and_clears() {
        let t = LoginThrottle::new(None);
        let ip = "10.0.0.1";
        assert!(!t.is_blocked(ip).await, "limpo no inicio");
        for _ in 0..LOGIN_MAX_ATTEMPTS {
            t.record_failure(ip).await;
        }
        assert!(t.is_blocked(ip).await, "bloqueia ao atingir o limite");
        t.clear(ip).await;
        assert!(!t.is_blocked(ip).await, "login bem-sucedido limpa o contador");
    }

    /// Path Redis — roda apenas se REDIS_TEST_URL estiver definido.
    #[tokio::test]
    async fn redis_throttle_blocks_after_max_and_clears() {
        let Ok(url) = std::env::var("REDIS_TEST_URL") else {
            return;
        };
        let client = redis::Client::open(url).expect("redis url valida");
        let cm = redis::aio::ConnectionManager::new(client)
            .await
            .expect("conecta no redis de teste");
        let t = LoginThrottle::new(Some(cm));
        let ip = format!("test-{}", uuid::Uuid::new_v4());

        assert!(!t.is_blocked(&ip).await);
        for _ in 0..LOGIN_MAX_ATTEMPTS {
            t.record_failure(&ip).await;
        }
        assert!(t.is_blocked(&ip).await, "bloqueia ao atingir o limite (redis)");
        t.clear(&ip).await;
        assert!(!t.is_blocked(&ip).await, "clear remove a chave (redis)");
    }
}
