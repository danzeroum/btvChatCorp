-- Sprint 1 — Indice em api_keys.key_hash
-- O middleware api_key_auth faz SELECT por key_hash em toda requisicao;
-- sem indice isso e' seq-scan O(n). Com o indice abaixo vira B-tree O(log n).

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
    ON api_keys (key_hash)
    WHERE is_active = true;

COMMENT ON INDEX idx_api_keys_key_hash IS
    'Lookup rapido de API keys ativas pelo hash SHA-256 da chave.';
