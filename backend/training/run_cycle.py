#!/usr/bin/env python3
"""
Entrypoint CLI para o ciclo de treinamento contínuo.

Uso:
    # Treina todos os workspaces com auto-training ativado
    python -m training.run_cycle --all-workspaces

    # Treina um workspace específico
    python -m training.run_cycle --workspace-id <uuid>

    # Gera QA sintéticos de novos documentos
    python -m training.run_cycle --generate-qa
"""
import argparse
import asyncio
import logging
import os
import sys

import psycopg2
import psycopg2.extras

from .continuous_trainer import ContinuousTrainer
from .synthetic_qa import SyntheticQAGenerator
from .config import TrainerConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://btv:btv@localhost:5432/btvchat")
VLLM_URL = os.environ.get("VLLM_URL", "http://localhost:8000")


def get_active_workspaces(db_url: str) -> list[str]:
    conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT w.id
        FROM workspaces w
        JOIN workspace_settings ws ON ws.workspace_id = w.id
        WHERE ws.auto_training = TRUE
          AND w.status = 'active'
        """
    )
    ids = [str(row["id"]) for row in cur.fetchall()]
    conn.close()
    return ids


def run_training(workspace_id: str) -> None:
    cfg = TrainerConfig(database_url=DATABASE_URL, vllm_url=VLLM_URL)
    trainer = ContinuousTrainer(workspace_id=workspace_id, config=cfg)
    trainer.run_training_cycle()


async def run_qa_generation(workspace_id: str) -> None:
    gen = SyntheticQAGenerator(database_url=DATABASE_URL, vllm_url=VLLM_URL)
    await gen.generate_for_new_documents(workspace_id)


def main() -> None:
    parser = argparse.ArgumentParser(description="BTV AI Training Runner")
    parser.add_argument("--all-workspaces", action="store_true")
    parser.add_argument("--workspace-id", type=str)
    parser.add_argument("--generate-qa", action="store_true")
    args = parser.parse_args()

    if args.all_workspaces:
        workspace_ids = get_active_workspaces(DATABASE_URL)
        logger.info(f"Treinando {len(workspace_ids)} workspaces")
        for wid in workspace_ids:
            try:
                if args.generate_qa:
                    asyncio.run(run_qa_generation(wid))
                else:
                    run_training(wid)
            except Exception as e:
                logger.error(f"Erro no workspace {wid}: {e}")

    elif args.workspace_id:
        if args.generate_qa:
            asyncio.run(run_qa_generation(args.workspace_id))
        else:
            run_training(args.workspace_id)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
