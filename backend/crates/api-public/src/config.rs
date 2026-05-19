//! Configuracao do BTV Gateway via variaveis de ambiente.

#[derive(Debug, Clone)]
pub struct GatewayConfig {
    /// Endereco de bind do servidor (default: 0.0.0.0:4000)
    pub bind_addr: String,
    /// URL da API interna do BTV (repassar chamadas)
    pub internal_api_url: String,
    /// URL do banco de dados (para validar API keys)
    pub database_url: String,
    /// Requisicoes por minuto por API key (default: 60)
    pub rate_limit_rpm: u32,
}

impl GatewayConfig {
    pub fn from_env() -> Self {
        Self {
            bind_addr: std::env::var("GATEWAY_BIND_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:4000".to_string()),
            internal_api_url: std::env::var("INTERNAL_API_URL")
                .unwrap_or_else(|_| "http://api:3000".to_string()),
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL obrigatoria"),
            rate_limit_rpm: std::env::var("GATEWAY_RATE_LIMIT_RPM")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
        }
    }
}
