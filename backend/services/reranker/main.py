"""Serviço de re-ranking com Cross-Encoder (ms-marco-MiniLM-L-12-v2).

Recebe pares (query, document) e retorna scores de relevância.
Muito mais preciso que similaridade cosseno, mas mais lento.
Por isso só roda nos ~20 candidatos, não nos milhões de chunks.

API:
  POST /rerank  { query: str, documents: [str] } -> { scores: [float] }
  GET  /health  -> { status: ok }
"""

from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cross-encoder multilíngue — bom para PT-BR
# Alternativa multilíngue: "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-12-v2"
MAX_LENGTH = 512

reranker: CrossEncoder = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global reranker
    logger.info(f"Loading cross-encoder model: {MODEL_NAME}")
    reranker = CrossEncoder(MODEL_NAME, max_length=MAX_LENGTH)
    logger.info("Reranker ready")
    yield
    # cleanup
    reranker = None


app = FastAPI(
    title="Reranker Service",
    description="Cross-encoder re-ranking for RAG pipeline",
    version="1.0.0",
    lifespan=lifespan,
)


class RerankRequest(BaseModel):
    query: str
    documents: List[str]


class RerankResponse(BaseModel):
    scores: List[float]


@app.post("/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest) -> RerankResponse:
    """Reranqueia documentos para uma query usando cross-encoder."""
    if not request.documents:
        return RerankResponse(scores=[])

    # Cria pares (query, documento) para o cross-encoder
    pairs = [(request.query, doc) for doc in request.documents]

    # Cross-encoder avalia cada par independentemente
    # Retorna logit score — não é probabilidade, mas é comparável
    scores = reranker.predict(pairs)

    return RerankResponse(scores=scores.tolist())


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
