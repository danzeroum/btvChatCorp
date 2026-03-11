"""
LLMClient unificado — abstrai vLLM local e Ollama externo.

Selecionado via variável de ambiente LLM_PROVIDER:
  - "vllm"   — usa vLLM (OpenAI-compatível) rodando localmente
  - "ollama" — usa Ollama externo via HTTP Basic Auth

Ambos expem a mesma interface:
  - chat_completion()   — resposta completa
  - stream_completion() — gerador assíncrono de tokens (SSE)
  - list_models()       — lista modelos disponíveis no provedor
"""
import json
import logging
from typing import AsyncGenerator

import httpx

from .config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER

        if self.provider == "ollama":
            auth = (settings.OLLAMA_AUTH_USER, settings.OLLAMA_AUTH_PASS)
            self._base_url = settings.OLLAMA_HOST.rstrip("/")
            self._default_model = settings.OLLAMA_MODEL
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                auth=auth,
                timeout=120,
                headers={"Content-Type": "application/json"},
            )
        else:  # vllm
            self._base_url = settings.VLLM_URL.rstrip("/")
            self._default_model = settings.VLLM_MODEL
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=120,
                headers={"Content-Type": "application/json"},
            )

        logger.info(
            f"LLMClient iniciado | provider={self.provider} | "
            f"host={self._base_url} | model={self._default_model}"
        )

    # ----------------------------------------------------------------
    # Lista de modelos disponíveis
    # ----------------------------------------------------------------

    async def list_models(self) -> list[dict]:
        """Retorna lista de modelos disponíveis no servidor."""
        if self.provider == "ollama":
            resp = await self._client.get("/api/tags")
            resp.raise_for_status()
            # Ollama retorna {"models": [{"name": "llama3.3:70b", ...}]}
            return [
                {"id": m["name"], "size": m.get("size"), "modified_at": m.get("modified_at")}
                for m in resp.json().get("models", [])
            ]
        else:  # vllm — OpenAI-compat /v1/models
            resp = await self._client.get("/v1/models")
            resp.raise_for_status()
            return [
                {"id": m["id"], "size": None, "modified_at": None}
                for m in resp.json().get("data", [])
            ]

    # ----------------------------------------------------------------
    # Chat completion (resposta completa)
    # ----------------------------------------------------------------

    async def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        lora_name: str | None = None,
    ) -> str:
        """
        Retorna a resposta completa como string.
        lora_name é usado apenas no modo vllm (LoRA workspace).
        """
        model = model or self._default_model

        if self.provider == "ollama":
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }
            resp = await self._client.post("/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()["message"]["content"]

        else:  # vllm (OpenAI-compat)
            payload = {
                "model": lora_name or model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            }
            resp = await self._client.post("/v1/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ----------------------------------------------------------------
    # Stream completion (SSE — token a token)
    # ----------------------------------------------------------------

    async def stream_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        lora_name: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Gerador assíncrono de tokens. Cada yield é um chunk de texto.
        Usado pelo endpoint SSE do chat em tempo real.
        """
        model = model or self._default_model

        if self.provider == "ollama":
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }
            async with self._client.stream("POST", "/api/chat", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

        else:  # vllm (OpenAI SSE)
            payload = {
                "model": lora_name or model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            async with self._client.stream(
                "POST", "/v1/chat/completions", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[len("data: "):].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        data = json.loads(raw)
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def close(self):
        await self._client.aclose()


# Singleton — injetado via FastAPI Depends
_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
