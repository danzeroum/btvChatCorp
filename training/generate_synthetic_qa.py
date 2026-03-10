#!/usr/bin/env python3
"""
Gera pares Q&A sintéticos de documentos novos usando o próprio LLM.
Roda toda quarta-feira às 2h via cron.
"""

import json
import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

import psycopg2
import httpx

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

GENERATION_PROMPT = """Baseado no seguinte trecho de documento, gere {num_questions} perguntas que um profissional faria sobre esse conteúdo, junto com respostas precisas baseadas APENAS no texto fornecido.

Documento:
{chunk_text}

Formato de saída (JSON):
[
  {{"question": "...", "answer": "..."}},
  {{"question": "...", "answer": "..."}}
]"""


@dataclass
class QAPair:
    question: str
    answer: str
    chunk_id: str
    document_name: str
    workspace_id: str


class SyntheticQAGenerator:
    def __init__(self, config: dict):
        self.config = config
        self.db = psycopg2.connect(config['database_url'])
        self.llm_url = config['vllm_url']
        self.num_questions = config.get('questions_per_chunk', 3)

    def run(self):
        log.info("Iniciando geração de Q&A sintéticos")
        workspaces = self._get_active_workspaces()
        total = 0
        for ws_id in workspaces:
            count = asyncio.run(self.process_workspace(ws_id))
            total += count
            log.info(f"Workspace {ws_id}: {count} pares gerados")
        log.info(f"Total: {total} pares Q&A sintéticos gerados")

    async def process_workspace(self, workspace_id: str) -> int:
        chunks = self._get_unprocessed_chunks(workspace_id)
        if not chunks:
            return 0

        qa_pairs = []
        async with httpx.AsyncClient(timeout=60) as client:
            for chunk in chunks:
                try:
                    pairs = await self._generate_qa(client, chunk)
                    qa_pairs.extend(pairs)
                except Exception as e:
                    log.warning(f"Erro ao processar chunk {chunk['id']}: {e}")

        self._save_qa_pairs(qa_pairs)
        return len(qa_pairs)

    async def _generate_qa(self, client: httpx.AsyncClient, chunk: dict) -> list[QAPair]:
        prompt = GENERATION_PROMPT.format(
            chunk_text=chunk['content'][:2000],  # Limita para não estourar contexto
            num_questions=self.num_questions,
        )

        response = await client.post(
            f"{self.llm_url}/v1/chat/completions",
            json={
                "model": self.config.get('model', 'llama-3.3-70b'),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1024,
            }
        )
        response.raise_for_status()

        content = response.json()['choices'][0]['message']['content']

        # Extrai JSON da resposta
        start = content.find('[')
        end = content.rfind(']') + 1
        if start == -1 or end == 0:
            return []

        qa_list = json.loads(content[start:end])
        return [
            QAPair(
                question=qa['question'],
                answer=qa['answer'],
                chunk_id=chunk['id'],
                document_name=chunk['document_name'],
                workspace_id=chunk['workspace_id'],
            )
            for qa in qa_list
            if qa.get('question') and qa.get('answer')
        ]

    def _get_active_workspaces(self) -> list[str]:
        cur = self.db.cursor()
        cur.execute("SELECT id FROM workspaces WHERE active = TRUE")
        return [str(row[0]) for row in cur.fetchall()]

    def _get_unprocessed_chunks(self, workspace_id: str) -> list[dict]:
        cur = self.db.cursor()
        cur.execute("""
            SELECT c.id, c.content, c.token_count,
                   d.name AS document_name, c.workspace_id
            FROM document_chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.workspace_id = %s
              AND c.qa_generated = FALSE
              AND d.classification != 'RESTRICTED'
              AND c.token_count > 100
            ORDER BY c.created_at DESC
            LIMIT 200
        """, (workspace_id,))
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]

    def _save_qa_pairs(self, pairs: list[QAPair]) -> None:
        if not pairs:
            return
        cur = self.db.cursor()
        cur.executemany("""
            INSERT INTO training_documents (
                workspace_id, document_name, chunk_text,
                generated_question, generated_answer,
                curator_status
            )
            SELECT %s, %s,
                   (SELECT content FROM document_chunks WHERE id = %s),
                   %s, %s,
                   'pending'
        """, [
            (p.workspace_id, p.document_name, p.chunk_id, p.question, p.answer)
            for p in pairs
        ])
        # Marca chunks como processados
        chunk_ids = list({p.chunk_id for p in pairs})
        cur.execute(
            "UPDATE document_chunks SET qa_generated = TRUE WHERE id = ANY(%s)",
            (chunk_ids,)
        )
        self.db.commit()
        log.info(f"{len(pairs)} pares Q&A salvos no banco")


if __name__ == '__main__':
    import os
    config = {
        'database_url': os.environ['DATABASE_URL'],
        'vllm_url': os.environ.get('VLLM_URL', 'http://localhost:8000'),
        'model': os.environ.get('MODEL_NAME', 'llama-3.3-70b'),
        'questions_per_chunk': int(os.environ.get('QUESTIONS_PER_CHUNK', '3')),
    }
    generator = SyntheticQAGenerator(config)
    generator.run()
