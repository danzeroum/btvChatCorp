FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Pré-baixa os modelos na imagem (evita cold start em produção)
RUN python3 -c "\
from transformers import AutoTokenizer, AutoModel; \
AutoTokenizer.from_pretrained('nomic-ai/nomic-embed-text-v2-moe', trust_remote_code=True); \
AutoModel.from_pretrained('nomic-ai/nomic-embed-text-v2-moe', trust_remote_code=True); \
from sentence_transformers import CrossEncoder; \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2');"

COPY app/ ./app/

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
