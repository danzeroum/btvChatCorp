import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..llm_client import LLMClient, get_llm_client

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    model: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = False


class ChatResponse(BaseModel):
    response: str
    model: str
    provider: str


@router.post("/", response_model=ChatResponse, summary="Chat com o LLM")
async def chat(
    req: ChatRequest,
    llm: LLMClient = Depends(get_llm_client),
):
    """
    Envia uma mensagem para o LLM e retorna a resposta completa.
    """
    messages = req.history + [{"role": "user", "content": req.message}]

    response = await llm.chat_completion(
        messages=messages,
        model=req.model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )

    return ChatResponse(
        response=response,
        model=req.model or llm._default_model,
        provider=llm.provider,
    )


async def _sse_generator(
    messages: list[dict],
    llm: LLMClient,
    model: str | None,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    async for token in llm.stream_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/stream", summary="Chat streaming (SSE)")
async def chat_stream(
    req: ChatRequest,
    llm: LLMClient = Depends(get_llm_client),
):
    """
    Streaming SSE — retorna tokens conforme o LLM gera.
    O cliente deve consumir o EventSource.
    """
    messages = req.history + [{"role": "user", "content": req.message}]

    return StreamingResponse(
        _sse_generator(
            messages=messages,
            llm=llm,
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
