//! Hashing de API keys.
//!
//! As API keys nunca são armazenadas em texto. Usamos HMAC-SHA256 com um segredo
//! da aplicação (`API_KEY_HMAC_SECRET`) — diferente de SHA-256 puro, o HMAC com
//! segredo torna inviável ataque por rainbow table mesmo se o banco vazar.
//!
//! Durante a migração das keys legadas (hash SHA-256 puro), a verificação aceita
//! ambos os formatos. Após a rotação de todas as keys, o fallback SHA-256 deve ser
//! removido (ver `verify_api_key` / lookup no middleware).

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

/// HMAC-SHA256 hex da API key — formato atual (com segredo).
pub fn hash_api_key_hmac(key: &str, secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC aceita chave de qualquer tamanho");
    mac.update(key.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// SHA-256 hex puro — formato LEGADO, mantido apenas para o fallback de migração.
pub fn hash_api_key_sha256(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verifica uma key contra um hash já conhecido, aceitando HMAC (atual) ou
/// SHA-256 (legado). Remover o segundo ramo após a rotação de todas as keys.
#[allow(dead_code)]
pub fn verify_api_key(key: &str, stored_hash: &str, secret: &str) -> bool {
    hash_api_key_hmac(key, secret) == stored_hash || hash_api_key_sha256(key) == stored_hash
}
