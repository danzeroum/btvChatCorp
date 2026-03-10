#!/usr/bin/env python3
"""
Entry point do ciclo de treinamento.
Roda todo domingo às 3h via cron.
Uso: python run_cycle.py --all-workspaces
     python run_cycle.py --workspace <id>
"""

import argparse
import logging
import os
import psycopg2
from continuous_trainer import ContinuousTrainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)


def get_config() -> dict:
    return {
        'database_url': os.environ['DATABASE_URL'],
        'base_model': os.environ.get('BASE_MODEL', 'meta-llama/Llama-3.3-70B'),
        'vllm_url': os.environ.get('VLLM_URL', 'http://localhost:8000'),
        'lora_dir': os.environ.get('LORA_DIR', '/models/lora'),
        'min_examples': int(os.environ.get('MIN_TRAINING_EXAMPLES', '50')),
    }


def get_all_workspace_ids(database_url: str) -> list[str]:
    db = psycopg2.connect(database_url)
    cur = db.cursor()
    cur.execute("""
        SELECT id FROM workspaces
        WHERE active = TRUE
          AND training_enabled = TRUE
    """)
    return [str(row[0]) for row in cur.fetchall()]


def main():
    parser = argparse.ArgumentParser(description='AI Training Cycle Runner')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--all-workspaces', action='store_true', help='Treina todos os workspaces ativos')
    group.add_argument('--workspace', type=str, help='ID do workspace específico')
    args = parser.parse_args()

    config = get_config()

    if args.all_workspaces:
        workspace_ids = get_all_workspace_ids(config['database_url'])
        log.info(f"Processando {len(workspace_ids)} workspace(s)")
    else:
        workspace_ids = [args.workspace]

    results = {'success': 0, 'skipped': 0, 'failed': 0}

    for ws_id in workspace_ids:
        try:
            trainer = ContinuousTrainer(ws_id, config)
            trainer.run_training_cycle()
            results['success'] += 1
        except ValueError as e:
            log.info(f"Workspace {ws_id} pulado: {e}")
            results['skipped'] += 1
        except Exception as e:
            log.error(f"Erro no workspace {ws_id}: {e}", exc_info=True)
            results['failed'] += 1

    log.info(f"Ciclo concluído: {results}")


if __name__ == '__main__':
    main()
