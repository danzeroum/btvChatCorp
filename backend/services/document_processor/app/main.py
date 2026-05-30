from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from pydantic import BaseModel
import logging
import os
import secrets

logger = logging.getLogger(__name__)
app = FastAPI(title="BTV Document Processor", version="1.0.0")

# Token compartilhado para autenticar chamadas internas (backend Rust → este serviço).
INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")


async def verify_internal_token(x_internal_token: str = Header(default="")):
    """Exige X-Internal-Token válido. Aplicado só em rotas funcionais, não no /health."""
    if not INTERNAL_TOKEN:
        raise HTTPException(503, "INTERNAL_SERVICE_TOKEN não configurado no serviço")
    if not secrets.compare_digest(x_internal_token, INTERNAL_TOKEN):
        raise HTTPException(401, "Token interno inválido")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "document-processor"}


class ProcessRequest(BaseModel):
    document_id: str
    workspace_id: str
    file_path: str
    file_type: str


@app.post("/process", dependencies=[Depends(verify_internal_token)])
async def process_document(req: ProcessRequest):
    """
    Recebe metadados de um documento já salvo em disco,
    extrai texto, divide em chunks, detecta PII e indexa no Qdrant.
    """
    logger.info(f"Processando documento {req.document_id} do workspace {req.workspace_id}")
    # TODO: implementar pipeline completo de processamento
    return {"status": "queued", "document_id": req.document_id}
