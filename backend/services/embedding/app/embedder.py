import torch
import numpy as np
from transformers import AutoTokenizer, AutoModel
from typing import List
import logging

logger = logging.getLogger(__name__)

# Nomic Embed V2 — 768 dimensões, multilingual, SOTA open-source
MODEL_NAME = "nomic-ai/nomic-embed-text-v2-moe"

# Prefixos de instrução que o Nomic V2 usa para diferenciar query de documento
# Isso melhora drasticamente a qualidade do RAG
PREFIX_QUERY    = "search_query: "
PREFIX_DOCUMENT = "search_document: "


class NomicEmbedder:
    """
    Wrapper para Nomic Embed Text V2 MoE (Mixture of Experts).
    - 768 dimensões (compatível com Qdrant collections já criadas)
    - Usa matryoshka: pode truncar para 256 ou 512 dims se necessário
    - Suporta textos em PT-BR nativamente
    """

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"[Embedder] Carregando {MODEL_NAME} em {self.device}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
        )
        self.model = AutoModel.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
        ).to(self.device)
        self.model.eval()
        logger.info("[Embedder] Modelo carregado com sucesso")

    def embed(self, texts: List[str], input_type: str = "document") -> List[List[float]]:
        """
        Gera embeddings em batch.
        - input_type='query'    → prefixo 'search_query:'
        - input_type='document' → prefixo 'search_document:'
        Processa em batches de 32 para não explodir a VRAM.
        """
        prefix = PREFIX_QUERY if input_type == "query" else PREFIX_DOCUMENT
        prefixed = [f"{prefix}{t}" for t in texts]

        all_embeddings: List[List[float]] = []
        batch_size = 32

        for i in range(0, len(prefixed), batch_size):
            batch = prefixed[i : i + batch_size]
            encoded = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=8192,   # Nomic V2 suporta contexto longo
                return_tensors="pt",
            ).to(self.device)

            with torch.no_grad():
                output = self.model(**encoded)

            # Mean pooling nos token embeddings (ignora [PAD])
            embeddings = self._mean_pool(
                output.last_hidden_state,
                encoded["attention_mask"],
            )

            # L2 normalize — essencial para similaridade cosseno no Qdrant
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
            all_embeddings.extend(embeddings.cpu().float().numpy().tolist())

        return all_embeddings

    @staticmethod
    def _mean_pool(
        token_embeddings: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """Media ponderada pelos tokens não-PAD."""
        mask_expanded = (
            attention_mask.unsqueeze(-1)
            .expand(token_embeddings.size())
            .float()
        )
        return torch.sum(token_embeddings * mask_expanded, dim=1) / torch.clamp(
            mask_expanded.sum(dim=1), min=1e-9
        )

    @property
    def dimensions(self) -> int:
        return 768

    @property
    def model_name(self) -> str:
        return MODEL_NAME
