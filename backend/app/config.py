from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco
    DATABASE_URL: str = "postgresql://btv:btv@localhost:5432/btvchat"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""

    # Serviços internos
    EMBEDDING_URL: str = "http://localhost:8001"
    RAG_SEARCHER_URL: str = "http://localhost:9000"

    # Auth
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    ENCRYPTION_KEY: str

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:4200"

    # Logs
    LOG_LEVEL: str = "info"

    # ----------------------------------------------------------------
    # LLM Provider — "vllm" ou "ollama"
    # ----------------------------------------------------------------
    LLM_PROVIDER: str = "ollama"  # padrao dev

    # vLLM (produção local)
    VLLM_URL: str = "http://vllm:8000"
    VLLM_MODEL: str = "llama3"

    # Ollama externo (VPS / desenvolvimento)
    OLLAMA_HOST: str = "https://api.buildtovalue.cloud"
    OLLAMA_AUTH_USER: str = "buildtovalue"
    OLLAMA_AUTH_PASS: str = "BTV_secure_2026!"
    OLLAMA_MODEL: str = "llama3.3:70b"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
