import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .embedder import NomicEmbedder
from .reranker import CrossEncoderReranker
from .models import EmbedRequest, EmbedResponse, RerankRequest, RerankResponse, HealthResponse
from .health import get_gpu_info, get_system_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Singletons (carregados uma vez no startup) ────────────────────────────────

embedder: Optional[NomicEmbedder] = None
reranker: Optional[CrossEncoderReranker] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedder, reranker
    logger.info("[startup] Carregando modelos...")
    embedder = NomicEmbedder()
    reranker = CrossEncoderReranker()
    logger.info("[startup] Pronto para receber requisições")
    yield
    logger.info("[shutdown] Liberando memória")
    del embedder, reranker


# ─── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BTV Embedding Service",
    description="Nomic Embed V2 (768-dim) + Cross-Encoder Reranker para RAG pipeline",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── Middleware de latência ────────────────────────────────────────────────────

@app.middleware("http")
async def add_latency_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Latency-Ms"] = f"{elapsed_ms:.1f}"
    return response


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/embed", response_model=EmbedResponse)
async def embed_texts(request: EmbedRequest):
    """
    Gera embeddings para uma lista de textos.

    - **input_type=document**: para indexação de chunks (prefixo `search_document:`)
    - **input_type=query**: para embeddings de consulta (prefixo `search_query:`)

    Retorna vetor de 768 dimensões por texto (L2 normalizado).
    """
    if embedder is None:
        raise HTTPException(503, detail="Embedding model not loaded")

    if not request.texts:
        raise HTTPException(400, detail="texts must not be empty")

    try:
        vectors = embedder.embed(request.texts, input_type=request.input_type)
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(500, detail=str(e))

    return EmbedResponse(
        embeddings=vectors,
        model=embedder.model_name,
        dimensions=embedder.dimensions,
        input_type=request.input_type,
        count=len(vectors),
    )


@app.post("/rerank", response_model=RerankResponse)
async def rerank_documents(request: RerankRequest):
    """
    Pontua a relevância de cada documento para a query usando cross-encoder.

    Recebe a query e até 64 documentos; retorna um score por documento
    (quanto maior, mais relevante). Scores são logits brutos.
    """
    if reranker is None:
        raise HTTPException(503, detail="Reranker model not loaded")

    try:
        scores = reranker.rerank(request.query, request.documents)
    except Exception as e:
        logger.error(f"Rerank error: {e}")
        raise HTTPException(500, detail=str(e))

    return RerankResponse(
        scores=scores,
        model=reranker.model_name,
        count=len(scores),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Retorna status do serviço, device, VRAM e métricas de sistema."""
    gpu_name, vram_total, vram_used = get_gpu_info()
    sys_info = get_system_info()

    return HealthResponse(
        status="ok" if embedder and reranker else "loading",
        embedding_model=embedder.model_name if embedder else "not_loaded",
        reranker_model=reranker.model_name if reranker else "not_loaded",
        device="cuda" if gpu_name else "cpu",
        gpu_name=gpu_name,
        vram_total_gb=vram_total,
        vram_used_gb=vram_used,
        cpu_percent=sys_info["cpu_percent"],
        ram_used_gb=sys_info["ram_used_gb"],
    )
