from fastapi import APIRouter, Depends
from ..llm_client import LLMClient, get_llm_client

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/", summary="Lista modelos disponíveis no provedor LLM")
async def list_available_models(
    llm: LLMClient = Depends(get_llm_client),
):
    """
    Retorna os modelos disponíveis no servidor LLM configurado.
    Em modo Ollama: lista os modelos já baixados na VPS.
    Em modo vLLM: lista os modelos carregados.
    """
    models = await llm.list_models()
    return {
        "provider": llm.provider,
        "host": llm._base_url,
        "current_model": llm._default_model,
        "available_models": models,
    }


@router.post("/pull", summary="Baixa um modelo no servidor Ollama")
async def pull_model(
    model_name: str,
    llm: LLMClient = Depends(get_llm_client),
):
    """
    Apenas no modo Ollama: dispara o download de um modelo na VPS.
    Ex: llama3.1:8b, mistral:7b, gemma3:12b
    """
    if llm.provider != "ollama":
        return {"error": "Pull só disponível no modo Ollama"}

    import httpx
    async with httpx.AsyncClient(
        base_url=llm._base_url,
        auth=(llm._client.auth),
        timeout=600,  # pull pode demorar bastante
    ) as client:
        resp = await client.post("/api/pull", json={"name": model_name, "stream": False})
        resp.raise_for_status()
        return {"status": "ok", "model": model_name}
