# ─── Stage 1: Build Rust ──────────────────────────────────────────────────────
FROM rust:1.77-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia manifests primeiro para cache de dependências
COPY Cargo.toml Cargo.toml
COPY crates/api/Cargo.toml crates/api/Cargo.toml

# Dummy main para compilar dependências em cache
RUN mkdir -p crates/api/src && \
    echo 'fn main() {}' > crates/api/src/main.rs && \
    cargo build --release -p api 2>/dev/null || true

# Copia código real
COPY crates crates
COPY migrations migrations

# Build final
RUN touch crates/api/src/main.rs && \
    cargo build --release -p api

# ─── Stage 2: Runtime mínimo ─────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/api /app/api

EXPOSE 8080

CMD ["/app/api"]
