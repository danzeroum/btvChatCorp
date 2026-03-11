FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3-pip python3.11-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Pré-baixa os modelos na imagem (evita cold start em produção)
RUN python3 -c "
from sentence_transformers import SentenceTransformer, CrossEncoder
SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
print('Modelos pré-carregados com sucesso')
"

COPY app/ app/

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
