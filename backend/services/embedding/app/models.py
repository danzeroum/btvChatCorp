from pydantic import BaseModel, Field
from typing import List, Optional


# ─── Embedding ────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=128)
    # 'query' usa prefixo 'search_query:' (Nomic instrução)
    # 'document' usa prefixo 'search_document:'
    input_type: str = Field(default="document", pattern="^(query|document)$")


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    dimensions: int
    input_type: str
    count: int


# ─── Reranker ─────────────────────────────────────────────────────────────────

class RerankRequest(BaseModel):
    query: str
    documents: List[str] = Field(..., min_length=1, max_length=64)


class RerankResponse(BaseModel):
    scores: List[float]
    model: str
    count: int


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    embedding_model: str
    reranker_model: str
    device: str
    gpu_name: Optional[str] = None
    vram_total_gb: Optional[float] = None
    vram_used_gb: Optional[float] = None
    cpu_percent: float
    ram_used_gb: float
