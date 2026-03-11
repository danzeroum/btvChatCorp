from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
app = FastAPI(title="BTV Document Processor", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "document-processor"}


class ProcessRequest(BaseModel):
    document_id: str
    workspace_id: str
    file_path: str
    file_type: str


@app.post("/process")
async def process_document(req: ProcessRequest):
    """
    Recebe metadados de um documento já salvo em disco,
    extrai texto, divide em chunks, detecta PII e indexa no Qdrant.
    """
    logger.info(f"Processando documento {req.document_id} do workspace {req.workspace_id}")
    # TODO: implementar pipeline completo de processamento
    return {"status": "queued", "document_id": req.document_id}
