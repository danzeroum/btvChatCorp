from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder
from typing import List
import logging

logger = logging.getLogger(__name__)
app = FastAPI(title="BTV Embedding Service", version="1.0.0")

embed_model = SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)
rerank_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "embedding"}


class EmbedRequest(BaseModel):
    texts: List[str]
    mode: str = "document"  # "document" ou "query"


class RerankRequest(BaseModel):
    query: str
    passages: List[str]


@app.post("/embed")
async def embed(req: EmbedRequest):
    prefix = "search_document: " if req.mode == "document" else "search_query: "
    texts = [prefix + t for t in req.texts]
    vectors = embed_model.encode(texts, normalize_embeddings=True).tolist()
    return {"embeddings": vectors, "dimensions": len(vectors[0]) if vectors else 0}


@app.post("/rerank")
async def rerank(req: RerankRequest):
    pairs = [[req.query, p] for p in req.passages]
    scores = rerank_model.predict(pairs).tolist()
    ranked = sorted(
        [{"text": p, "score": s} for p, s in zip(req.passages, scores)],
        key=lambda x: x["score"],
        reverse=True,
    )
    return {"results": ranked}
