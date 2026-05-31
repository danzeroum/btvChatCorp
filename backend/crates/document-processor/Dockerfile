# ── Build stage ────────────────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

WORKDIR /app

# Dependências do sistema para pdf-extract e reqwest TLS
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia os manifests da workspace + TODOS os crates membros.
# O backend/Cargo.toml declara todos os crates da workspace, então o Cargo
# precisa de todos os Cargo.toml presentes para resolver o grafo — mesmo que
# `--bin rag-worker` só compile o document-processor e suas dependências.
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/crates ./crates

# Cache de queries do sqlx (modo offline): permite compilar os `query!` macros
# sem um banco de dados acessível durante o `docker build`.
COPY backend/.sqlx ./.sqlx
ENV SQLX_OFFLINE=true

# Build do binário do worker
RUN cargo build --release --bin rag-worker

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/rag-worker /app/rag-worker

RUN mkdir -p /data/uploads

ENTRYPOINT ["/app/rag-worker"]
