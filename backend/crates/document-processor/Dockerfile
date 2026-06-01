# ── Build stage ────────────────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

# context = ./backend, então os paths são relativos a backend/
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build do binário do worker (sem SQLX_OFFLINE — queries em runtime)
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
