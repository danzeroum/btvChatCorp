"""
Serviço de Embedding — Nomic Embed V2 (768 dimensões)

API:
  POST /embed
    body: { "texts": [str], "task_type": "search_document" | "search_query" }
    resp: { "embeddings": [[float]] }

  POST /embed_query
    body: { "query": str }
    resp: { "embedding": [float] }

  GET  /health
    resp: { "status": "ok", "model": str }
"""

import os
import logging
from typing import List, Literal

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODEL_NAME   = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v2-moe")
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"
BATCH_SIZE   = int(os.getenv("EMBED_BATCH_SIZE", "32"))
MAX_LENGTH   = int(os.getenv("EMBED_MAX_LENGTH", "512"))
PORT         = int(os.getenv("PORT", "8001"))

log.info(f"Carregando modelo: {MODEL_NAME} em {DEVICE}")
model = SentenceTransformer(MODEL_NAME, trust_remote_code=True, device=DEVICE)
log.info("Modelo carregado.")

# ---------------------------------------------------------------------------
# App FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    texts: List[str]
    task_type: Literal["search_document", "search_query"] = "search_document"


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    dimensions: int


class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    embedding: List[float]
    model: str


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "device": DEVICE}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts não pode ser vazio")
    if len(req.texts) > 256:
        raise HTTPException(status_code=400, detail="Máximo 256 textos por requisição")

    # Adiciona prefixo de tarefa Nomic V2 se não estiver presente
    texts_with_prefix = [
        t if t.startswith("search_") else f"{req.task_type}: {t}"
        for t in req.texts
    ]

    try:
        embeddings = model.encode(
            texts_with_prefix,
            batch_size=BATCH_SIZE,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,  # normaliza para similaridade cosseno
        )
        return EmbedResponse(
            embeddings=embeddings.tolist(),
            model=MODEL_NAME,
            dimensions=embeddings.shape[1],
        )
    except Exception as e:
        log.error(f"Erro ao gerar embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed_query", response_model=QueryResponse)
async def embed_query(req: QueryRequest):
    text_with_prefix = f"search_query: {req.query}"
    try:
        embedding = model.encode(
            [text_with_prefix],
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return QueryResponse(embedding=embedding[0].tolist(), model=MODEL_NAME)
    except Exception as e:
        log.error(f"Erro ao gerar embedding da query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
