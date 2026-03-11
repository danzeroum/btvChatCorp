import torch
from sentence_transformers import CrossEncoder
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)

# Cross-encoder leve mas eficaz para reranking
# Alternativa mais pesada: cross-encoder/ms-marco-electra-base
MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class CrossEncoderReranker:
    """
    Reranker baseado em cross-encoder.
    Avalia a relevância do par (query, documento) juntos — muito mais preciso
    que comparar embeddings separados, ao custo de ~50ms de latência extra.

    Fluxo:
        Qdrant retorna top-20 por similaridade de cosseno
        → CrossEncoder pontua cada par (query, chunk)
        → Retorna top-5 reordenados por relevância real
    """

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"[Reranker] Carregando {MODEL_NAME} em {self.device}")
        self.model = CrossEncoder(
            MODEL_NAME,
            max_length=512,
            device=self.device,
        )
        logger.info("[Reranker] Modelo carregado")

    def rerank(
        self,
        query: str,
        documents: List[str],
    ) -> List[float]:
        """
        Retorna lista de scores (float) na mesma ordem dos documentos.
        Scores são logits brutos — quanto maior, mais relevante.
        """
        pairs: List[Tuple[str, str]] = [(query, doc) for doc in documents]
        scores: List[float] = self.model.predict(pairs, show_progress_bar=False).tolist()
        return scores

    @property
    def model_name(self) -> str:
        return MODEL_NAME
