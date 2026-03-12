import hashlib
import os
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/btvchat_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    "text/plain", "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/markdown", "text/csv",
}
MAX_SIZE_MB = 50


@router.post("/upload", summary="Upload de documento para base de conhecimento")
async def upload_document(file: UploadFile = File(...)):
    # Valida tipo
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo '{file.content_type}' n\u00e3o permitido. Use PDF, DOCX, TXT, MD ou CSV."
        )

    content = await file.read()

    # Valida tamanho
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Arquivo maior que {MAX_SIZE_MB}MB.")

    # Salva com hash para evitar duplicatas
    file_hash = hashlib.sha256(content).hexdigest()[:16]
    safe_name = f"{file_hash}_{file.filename}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(content)

    return {
        "status": "ok",
        "filename": file.filename,
        "size_bytes": len(content),
        "hash": file_hash,
        "path": str(dest),
        "message": "Documento recebido. Indexa\u00e7\u00e3o em fila."
    }


@router.get("/", summary="Lista documentos enviados")
async def list_documents():
    files = [
        {
            "filename": f.name.split("_", 1)[1] if "_" in f.name else f.name,
            "size_bytes": f.stat().st_size,
            "hash": f.name.split("_")[0],
        }
        for f in UPLOAD_DIR.iterdir() if f.is_file()
    ]
    return {"documents": files, "total": len(files)}
