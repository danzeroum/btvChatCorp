import time
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import models

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown


app = FastAPI(
    title="BTV Chat Corp API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(models.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME),
    }


@app.get("/api/health")
async def api_health():
    return {"status": "ok"}
