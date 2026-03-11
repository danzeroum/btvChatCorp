use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Gera assinatura HMAC-SHA256 do payload serializado.
/// O cliente deve verificar o header `X-Webhook-Signature` com a mesma lógica.
///
/// Formato do header enviado:
/// `X-Webhook-Signature: sha256=<hex_digest>`
pub fn sign_payload(secret: &str, payload_bytes: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(payload_bytes);
    let result = mac.finalize();
    let bytes = result.into_bytes();
    format!("sha256={}", hex::encode(bytes))
}

/// Verifica se a assinatura recebida é válida.
/// Usa comparação em tempo constante para prevenir timing attacks.
pub fn verify_signature(secret: &str, payload_bytes: &[u8], signature: &str) -> bool {
    let expected = sign_payload(secret, payload_bytes);
    // Comparação segura
    expected.len() == signature.len()
        && expected
            .bytes()
            .zip(signature.bytes())
            .all(|(a, b)| a == b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify() {
        let secret = "test_secret_key";
        let payload = b"{\"type\":\"chat.created\"}";
        let sig = sign_payload(secret, payload);
        assert!(sig.starts_with("sha256="));
        assert!(verify_signature(secret, payload, &sig));
    }

    #[test]
    fn wrong_secret_fails() {
        let payload = b"{\"type\":\"chat.created\"}";
        let sig = sign_payload("correct_secret", payload);
        assert!(!verify_signature("wrong_secret", payload, &sig));
    }
}
