"""Serviço de embedding — Nomic Embed Text V2 (MoE)

Endpoints:
    POST /embed   { "texts": [...] } -> { "embeddings": [[...], ...] }
    GET  /health  -> { "status": "ok", "model": "..." }
"""
import os
import time
from typing import List

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

MODEL_NAME  = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v2-moe")
BATCH_SIZE  = int(os.getenv("EMBED_BATCH_SIZE", "32"))
MAX_LENGTH  = int(os.getenv("EMBED_MAX_LENGTH", "512"))
PORT        = int(os.getenv("PORT", "8001"))

app   = FastAPI(title="BTV Embedding Service")
model = None  # carregado no startup


@app.on_event("startup")
async def load_model():
    global model
    print(f"Carregando modelo: {MODEL_NAME}")
    model = SentenceTransformer(
        MODEL_NAME,
        trust_remote_code=True,
        device="cuda" if torch.cuda.is_available() else "cpu",
    )
    print(f"Modelo carregado. Device: {model.device}")


class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model:      str
    duration_ms: float


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not req.texts:
        raise HTTPException(400, "texts vazio")
    if len(req.texts) > 256:
        raise HTTPException(400, "máximo 256 textos por request")

    t0 = time.monotonic()
    vecs = model.encode(
        req.texts,
        batch_size=BATCH_SIZE,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    elapsed = (time.monotonic() - t0) * 1000

    return EmbedResponse(
        embeddings=[v.tolist() for v in vecs],
        model=MODEL_NAME,
        duration_ms=round(elapsed, 2),
    )


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "device": str(model.device if model else "loading")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
