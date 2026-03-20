# ── Build stage ────────────────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

WORKDIR /app

# Dependências do sistema para pdf-extract e reqwest TLS
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia workspace Cargo files para cache de dependências
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/crates/document-processor/Cargo.toml crates/document-processor/

# Build só das dependências (cache layer)
RUN mkdir -p crates/document-processor/src && \
    echo 'fn main() {}' > crates/document-processor/src/main.rs && \
    cargo build --release --bin rag-worker 2>/dev/null || true

# Copia o código real
COPY backend/crates/document-processor/src crates/document-processor/src

# Build final
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
