import json
import logging
from typing import Optional

import psycopg2
import psycopg2.extras
import httpx

logger = logging.getLogger(__name__)

GENERATION_PROMPT = """Baseado no seguinte trecho de documento, gere exatamente 3 perguntas que um profissional da área faria sobre esse conteúdo, junto com respostas precisas baseadas APENAS no texto fornecido.

Documento:
{chunk_text}

Formato de saída (JSON válido, sem markdown):
[
  {{"question": "...", "answer": "..."}},
  {{"question": "...", "answer": "..."}},
  {{"question": "...", "answer": "..."}}
]"""


class SyntheticQAGenerator:
    """
    Gera pares QA sintéticos a partir de novos chunks de documentos.
    Usa o próprio vLLM (Llama 3.3 70B) para gerar as perguntas.
    Pares ficam com status 'pending' até curador aprovar.
    Roda toda quarta às 2h via cron.
    """

    def __init__(self, database_url: str, vllm_url: str = "http://localhost:8000"):
        self.db = psycopg2.connect(
            database_url,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        self.vllm_url = vllm_url

    async def generate_for_new_documents(self, workspace_id: str) -> int:
        """
        Busca chunks sem QA gerado e gera pares para cada um.
        Retorna quantos pares foram inseridos.
        """
        cur = self.db.cursor()
        cur.execute(
            """
            SELECT td.id, td.chunk_text, d.filename AS document_name
            FROM training_documents td
            JOIN documents d ON d.id = td.document_id
            WHERE td.workspace_id = %s
              AND td.generated_question IS NULL
              AND td.curator_status = 'pending'
            ORDER BY td.created_at DESC
            LIMIT 100
            """,
            (workspace_id,),
        )
        chunks = cur.fetchall()

        if not chunks:
            logger.info(f"[{workspace_id}] Nenhum chunk novo para gerar QA")
            return 0

        inserted = 0
        async with httpx.AsyncClient(timeout=60) as client:
            for chunk in chunks:
                try:
                    qa_pairs = await self._generate_qa(client, chunk["chunk_text"])
                    for qa in qa_pairs:
                        cur.execute(
                            """
                            INSERT INTO training_documents
                                (workspace_id, document_name, chunk_text,
                                 generated_question, generated_answer,
                                 curator_status)
                            VALUES (%s, %s, %s, %s, %s, 'pending')
                            """,
                            (
                                workspace_id,
                                chunk["document_name"],
                                chunk["chunk_text"],
                                qa["question"],
                                qa["answer"],
                            ),
                        )
                        inserted += 1
                except Exception as e:
                    logger.error(f"Erro ao gerar QA para chunk {chunk['id']}: {e}")
                    continue

        self.db.commit()
        logger.info(f"[{workspace_id}] {inserted} pares QA gerados (aguardando curadoria)")
        return inserted

    async def _generate_qa(self, client: httpx.AsyncClient, chunk_text: str) -> list[dict]:
        prompt = GENERATION_PROMPT.format(chunk_text=chunk_text[:3000])  # limite de tokens
        response = await client.post(
            f"{self.vllm_url}/v1/completions",
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct",
                "prompt": prompt,
                "max_tokens": 1024,
                "temperature": 0.3,
                "stop": ["]"],  # para no fim do JSON array
            },
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["text"]
        # Garante JSON válido mesmo que o modelo inclua markdown
        raw = raw.strip().lstrip("```json").rstrip("```").strip()
        if not raw.endswith("]"):
            raw += "]"  # fecha o array se truncado
        pairs = json.loads(raw)
        return pairs[:3]  # máximo 3 pares por chunk
