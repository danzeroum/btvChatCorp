from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder
from typing import List
import logging
import os
import secrets

logger = logging.getLogger(__name__)
app = FastAPI(title="BTV Embedding Service", version="1.0.0")

# Token compartilhado para autenticar chamadas internas (backend Rust → este serviço).
INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")


async def verify_internal_token(x_internal_token: str = Header(default="")):
    """Exige X-Internal-Token válido. Aplicado só em rotas funcionais, não no /health."""
    if not INTERNAL_TOKEN:
        raise HTTPException(503, "INTERNAL_SERVICE_TOKEN não configurado no serviço")
    if not secrets.compare_digest(x_internal_token, INTERNAL_TOKEN):
        raise HTTPException(401, "Token interno inválido")

HF_CACHE = os.getenv("HF_HOME", "/model_cache")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v1.5")
# Revisão fixa obrigatória (hash de commit auditado) ao usar trust_remote_code.
EMBEDDING_MODEL_REVISION = os.getenv("EMBEDDING_MODEL_REVISION")
if not EMBEDDING_MODEL_REVISION:
    raise RuntimeError(
        "EMBEDDING_MODEL_REVISION obrigatório: fixe um hash de commit auditado do "
        "HuggingFace antes de carregar um modelo com trust_remote_code."
    )

logger.info("Carregando modelo de embedding (pode demorar no primeiro start)...")
embed_model = SentenceTransformer(
    EMBEDDING_MODEL,
    revision=EMBEDDING_MODEL_REVISION,
    trust_remote_code=True,
    cache_folder=HF_CACHE,
)

logger.info("Carregando modelo de reranking...")
rerank_model = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
    max_length=512,
)

logger.info("Modelos prontos.")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "embedding"}


class EmbedRequest(BaseModel):
    texts: List[str]
    mode: str = "document"


class RerankRequest(BaseModel):
    query: str
    passages: List[str]


@app.post("/embed", dependencies=[Depends(verify_internal_token)])
async def embed(req: EmbedRequest):
    prefix = "search_document: " if req.mode == "document" else "search_query: "
    texts = [prefix + t for t in req.texts]
    vectors = embed_model.encode(texts, normalize_embeddings=True).tolist()
    return {"embeddings": vectors, "dimensions": len(vectors[0]) if vectors else 0}


@app.post("/rerank", dependencies=[Depends(verify_internal_token)])
async def rerank(req: RerankRequest):
    pairs = [[req.query, p] for p in req.passages]
    scores = rerank_model.predict(pairs).tolist()
    ranked = sorted(
        [{"text": p, "score": s} for p, s in zip(req.passages, scores)],
        key=lambda x: x["score"],
        reverse=True,
    )
    return {"results": ranked}
