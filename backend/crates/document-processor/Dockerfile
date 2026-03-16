# ---- Build stage ----
FROM rust:1.82-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia workspace Cargo.toml para cache de dependências
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/

# Build do binário do worker
RUN cargo build --release --bin rag-worker

# ---- Runtime stage ----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rag-worker /usr/local/bin/rag-worker

# Cria diretório de uploads
RUN mkdir -p /data/uploads

ENV DATABASE_URL=""
ENV QDRANT_URL="http://qdrant:6333"
ENV EMBEDDING_URL="http://embedding:8001"
ENV STORAGE_PATH="/data/uploads"
ENV POLL_INTERVAL_SECS="10"
ENV WORKER_CONCURRENCY="4"
ENV MAX_RETRIES="3"

CMD ["rag-worker"]
