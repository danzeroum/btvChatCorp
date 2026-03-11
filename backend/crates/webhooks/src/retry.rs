use std::time::Duration;

/// Estratégia de retry com backoff exponencial.
/// Usada pelo dispatcher para calcular quando re-tentar entregas com falha.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub initial_delay_secs: u64,
    pub backoff_multiplier: f64,
    pub max_delay_secs: u64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 5,
            initial_delay_secs: 30,
            backoff_multiplier: 2.0,
            max_delay_secs: 3600, // máx 1 hora
        }
    }
}

impl RetryPolicy {
    /// Calcula o delay para a tentativa `attempt` (1-based).
    /// Attempt 1 = 30s, 2 = 60s, 3 = 120s, 4 = 240s, 5 = 480s
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        if attempt == 0 {
            return Duration::from_secs(0);
        }
        let exponent = (attempt - 1) as f64;
        let delay_secs =
            self.initial_delay_secs as f64 * self.backoff_multiplier.powf(exponent);
        let capped = delay_secs.min(self.max_delay_secs as f64) as u64;
        Duration::from_secs(capped)
    }

    /// Retorna true se deve re-tentar após `attempt` falhas.
    pub fn should_retry(&self, attempt: u32) -> bool {
        attempt <= self.max_retries
    }
}

/// Executa uma função assíncrona com retry automático.
/// Retorna Ok no primeiro sucesso ou Err após esgotar as tentativas.
pub async fn with_retry<F, Fut, T, E>(
    policy: &RetryPolicy,
    mut f: F,
) -> Result<T, E>
where
    F: FnMut(u32) -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Debug,
{
    let mut attempt = 1u32;
    loop {
        match f(attempt).await {
            Ok(val) => return Ok(val),
            Err(e) => {
                if !policy.should_retry(attempt) {
                    tracing::error!(
                        attempt = attempt,
                        "Retry policy exhausted after {} attempts: {:?}",
                        attempt, e
                    );
                    return Err(e);
                }
                let delay = policy.delay_for_attempt(attempt);
                tracing::warn!(
                    attempt = attempt,
                    delay_secs = delay.as_secs(),
                    "Webhook delivery failed, retrying in {}s: {:?}",
                    delay.as_secs(), e
                );
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_delays() {
        let policy = RetryPolicy::default();
        assert_eq!(policy.delay_for_attempt(1).as_secs(), 30);
        assert_eq!(policy.delay_for_attempt(2).as_secs(), 60);
        assert_eq!(policy.delay_for_attempt(3).as_secs(), 120);
        assert_eq!(policy.delay_for_attempt(4).as_secs(), 240);
        assert_eq!(policy.delay_for_attempt(5).as_secs(), 480);
    }

    #[test]
    fn max_retries_respected() {
        let policy = RetryPolicy::default();
        assert!(policy.should_retry(5));
        assert!(!policy.should_retry(6));
    }
}
