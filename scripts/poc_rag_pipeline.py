#!/usr/bin/env python3
"""
PoC do data-plane de RAG do BTV Chat Corp — reproduz, em Python, a lógica
determinística implementada em Rust/Python no repositório e valida contra as
PRÓPRIAS asserções do repo.

Cada função abaixo espelha 1:1 uma função real. As referências apontam para o
arquivo/linha de origem para auditoria.

Fontes:
  - backend/crates/api/src/rag.rs          (embed_query, reorder_by_scores,
                                            search_rag collection naming, filter,
                                            build_rag_context, build_sources_json)
  - backend/services/embedding/app/main.py (prefixos nomic-v2 search_query/document)
  - backend/services/embedding/app/main.py (rerank: sort desc por score)
"""
import hashlib
import hmac
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAG_RS = ROOT / "backend/crates/api/src/rag.rs"
EMBED_PY = ROOT / "backend/services/embedding/app/main.py"
SIGNER_RS = ROOT / "backend/crates/webhooks/src/signer.rs"

PASS, FAIL = "\033[92m[OK]\033[0m", "\033[91m[FAIL]\033[0m"
results = []


def check(name, cond, detail=""):
    results.append(cond)
    print(f"{PASS if cond else FAIL} {name}" + (f"  → {detail}" if detail else ""))


# ─────────────────────────────────────────────────────────────────────────────
# 1. Nomeação da collection Qdrant por workspace  (rag.rs:151)
#    let collection = format!("workspace_{}", workspace_id.replace('-', ""));
# ─────────────────────────────────────────────────────────────────────────────
def qdrant_collection(workspace_id: str) -> str:
    return f"workspace_{workspace_id.replace('-', '')}"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Filtro multi-tenant enviado ao Qdrant  (rag.rs:158-163)
#    filter: { "must": [{ "key": "workspace_id", "match": { "value": ws } }] }
# ─────────────────────────────────────────────────────────────────────────────
def qdrant_filter(workspace_id: str) -> dict:
    return {"must": [{"key": "workspace_id", "match": {"value": workspace_id}}]}


# ─────────────────────────────────────────────────────────────────────────────
# 3. Convenção de prefixo nomic-embed-v2  (embedding/main.py:67 + rag.rs:21)
#    doc  -> "search_document: ..."   query -> "search_query: ..."
# ─────────────────────────────────────────────────────────────────────────────
def with_prefix(text: str, mode: str) -> str:
    prefix = "search_document: " if mode == "document" else "search_query: "
    return prefix + text


# ─────────────────────────────────────────────────────────────────────────────
# 4. Reordenação pelo cross-encoder  (rag.rs:91 reorder_by_scores)
#    - zip(scores, chunks), ordena por score DESC
#    - se len(scores) != len(chunks) -> no-op (retorna ordem original)
# ─────────────────────────────────────────────────────────────────────────────
def reorder_by_scores(scores, chunks):
    if len(scores) != len(chunks):
        return chunks  # no-op seguro
    paired = sorted(zip(scores, chunks), key=lambda p: p[0], reverse=True)
    return [c for _, c in paired]


# ─────────────────────────────────────────────────────────────────────────────
# 5. over-fetch de candidatos quando o reranker está ligado  (rag.rs:146-150)
#    candidate_k = (top_k * 4).clamp(top_k, 50)   se RERANKER_URL setado
# ─────────────────────────────────────────────────────────────────────────────
def candidate_k(top_k: int, reranker_on: bool) -> int:
    if not reranker_on:
        return top_k
    return max(top_k, min(top_k * 4, 50))  # clamp(top_k, 50)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Bloco de contexto RAG injetado no system prompt  (rag.rs:221 build_rag_context)
# ─────────────────────────────────────────────────────────────────────────────
def build_rag_context(chunks):
    if not chunks:
        return None
    ctx = ("## Contexto recuperado da base de conhecimento\n"
           "Use as informações abaixo para responder. "
           "Cite a fonte entre parênteses ao final de cada afirmação.\n\n")
    for i, c in enumerate(chunks):
        ctx += f"### Fonte {i + 1} — {c['filename']} | {c['section']}\n{c['content']}\n\n"
    return ctx


# ─────────────────────────────────────────────────────────────────────────────
# 7. Assinatura HMAC-SHA256 do webhook  (signer.rs:12 sign_payload)
#    format!("sha256={}", hex::encode(hmac_sha256(secret, payload)))
# ─────────────────────────────────────────────────────────────────────────────
def sign_payload(secret: str, payload: bytes) -> str:
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# ============================= EXECUÇÃO / PROVAS ==============================
print("═══ PoC: data-plane de RAG + webhooks (lógica real do repositório) ═══\n")

# --- Prova 1: isolamento multi-tenant é determinístico e por-workspace ---
ws_a = "11111111-2222-3333-4444-555555555555"
ws_b = "99999999-8888-7777-6666-000000000000"
col_a, col_b = qdrant_collection(ws_a), qdrant_collection(ws_b)
print("1) Multi-tenancy — collection + filtro por workspace")
check("collection do WS-A", col_a == "workspace_11111111222233334444555555555555", col_a)
check("collections A e B são distintas", col_a != col_b, f"{col_a} != {col_b}")
check("filtro Qdrant fixa workspace_id do WS-A",
      qdrant_filter(ws_a)["must"][0]["match"]["value"] == ws_a)
# Verifica que o formato Rust real casa com o que reproduzimos:
rag_src = RAG_RS.read_text()
check("formato bate com o código Rust (rag.rs)",
      'format!("workspace_{}", workspace_id.replace(\'-\', ""))' in rag_src)

# --- Prova 2: convenção de embedding assimétrica (query vs document) ---
print("\n2) Embedding assimétrico nomic-v2 (query ≠ document)")
q = with_prefix("qual a política de férias?", "query")
d = with_prefix("A política de férias concede 30 dias.", "document")
check("query usa search_query:", q.startswith("search_query: "), q)
check("document usa search_document:", d.startswith("search_document: "), d)
check("prefixo confere com embedding/main.py",
      'search_document: ' in EMBED_PY.read_text() and 'search_query: ' in EMBED_PY.read_text())

# --- Prova 3: reranker reproduz a asserção do teste unitário do repo ---
print("\n3) Reranker cross-encoder — reordena por score DESC")
chunks = ["a", "b", "c"]
# teste do repo (rag.rs:272): scores a=0.1,b=0.9,c=0.5 -> ordem b,c,a
got = reorder_by_scores([0.1, 0.9, 0.5], chunks)
check("reorder produz [b, c, a] (idêntico ao teste Rust reorder_by_scores_sorts_desc)",
      got == ["b", "c", "a"], "".join(got))
# teste do repo (rag.rs:281): tamanho divergente -> no-op
noop = reorder_by_scores([0.9], ["a", "b"])
check("mismatch de tamanho é no-op (reorder_by_scores_mismatch_is_noop)",
      noop == ["a", "b"], "".join(noop))
# cross-check: as asserções acima existem literalmente no rag.rs
check("asserções existem no rag.rs", 'vec!["b", "c", "a"]' in rag_src)

# --- Prova 4: over-fetch de candidatos com clamp ---
print("\n4) Over-fetch para o reranker (clamp)")
check("top_k=5, reranker ON  → 20 candidatos", candidate_k(5, True) == 20, str(candidate_k(5, True)))
check("top_k=5, reranker OFF → 5  candidatos", candidate_k(5, False) == 5, str(candidate_k(5, False)))
check("top_k=20, reranker ON → 50 (teto do clamp)", candidate_k(20, True) == 50, str(candidate_k(20, True)))

# --- Prova 5: montagem do contexto RAG no prompt ---
print("\n5) Injeção de contexto no system prompt")
sample = [
    {"filename": "politica_rh.pdf", "section": "Férias", "content": "30 dias corridos.", "chunk_index": 3, "score": 0.87},
    {"filename": "codigo_conduta.pdf", "section": "Ética", "content": "Sigilo obrigatório.", "chunk_index": 1, "score": 0.71},
]
ctx = build_rag_context(sample)
check("contexto cita a fonte 1 (politica_rh.pdf)", "### Fonte 1 — politica_rh.pdf | Férias" in ctx)
check("contexto vazio → None (sem alucinar fonte)", build_rag_context([]) is None)

# --- Prova 6: HMAC de webhook (formato sha256=<hex>, mesmo do signer.rs) ---
print("\n6) Assinatura HMAC-SHA256 dos webhooks")
sig = sign_payload("test_secret_key", b'{"type":"chat.created"}')
check("assinatura tem formato sha256=<hex>", re.fullmatch(r"sha256=[0-9a-f]{64}", sig) is not None, sig)
check("segredo errado gera assinatura diferente",
      sign_payload("wrong", b'{"type":"chat.created"}') != sig)
check("formato confere com signer.rs", 'format!("sha256={}", hex::encode(bytes))' in SIGNER_RS.read_text())

# ============================= RESUMO ==============================
print("\n" + "═" * 60)
total, ok = len(results), sum(results)
print(f"Resultado: {ok}/{total} provas passaram")
sys.exit(0 if ok == total else 1)
