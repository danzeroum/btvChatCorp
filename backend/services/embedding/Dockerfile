FROM python:3.11-slim

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pré-download do modelo no build para evitar cold start
ARG MODEL_NAME=nomic-ai/nomic-embed-text-v2-moe
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${MODEL_NAME}', trust_remote_code=True)"

COPY main.py .

EXPOSE 8001
CMD ["python", "main.py"]
