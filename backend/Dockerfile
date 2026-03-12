# ─── Stage 1: Build Rust ──────────────────────────────────────────────────────
# rust:latest = 1.88+ que suporta edition2024
FROM rust:latest AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia manifests para cache de dependencias
COPY Cargo.toml Cargo.toml
COPY crates/api/Cargo.toml crates/api/Cargo.toml

# Dummy main para compilar deps em cache
RUN mkdir -p crates/api/src && \
    echo 'fn main() {}' > crates/api/src/main.rs && \
    cargo build --release -p api 2>/dev/null || true

# Copia codigo fonte real
COPY crates crates
COPY migrations migrations

# Build final
RUN touch crates/api/src/main.rs && \
    cargo build --release -p api

# ─── Stage 2: Runtime minimo ─────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/api /app/api

EXPOSE 8080

CMD ["/app/api"]
