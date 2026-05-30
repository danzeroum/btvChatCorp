import os

from sentence_transformers import SentenceTransformer, CrossEncoder

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v1.5")
# Revisão fixa obrigatória (hash de commit auditado) ao usar trust_remote_code.
EMBEDDING_MODEL_REVISION = os.getenv("EMBEDDING_MODEL_REVISION")
if not EMBEDDING_MODEL_REVISION:
    raise RuntimeError(
        "EMBEDDING_MODEL_REVISION obrigatório: fixe um hash de commit auditado do "
        "HuggingFace antes de pré-carregar um modelo com trust_remote_code."
    )

print("Baixando modelo de embedding...")
SentenceTransformer(
    EMBEDDING_MODEL,
    revision=EMBEDDING_MODEL_REVISION,
    trust_remote_code=True,
)

print("Baixando modelo de reranking...")
CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

print("Modelos pre-carregados com sucesso.")
