# Stage 1: Build
FROM rust:latest AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.toml
COPY crates/api/Cargo.toml crates/api/Cargo.toml

# Dummy build para cachear deps
RUN mkdir -p crates/api/src && \
    echo 'fn main() {}' > crates/api/src/main.rs && \
    cargo build --release -p api 2>/dev/null || true

COPY crates crates
# migrations em /app/migrations para sqlx::migrate!("./migrations")
COPY migrations migrations

RUN touch crates/api/src/main.rs && \
    cargo build --release -p api

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/api /app/api
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

CMD ["/app/api"]
