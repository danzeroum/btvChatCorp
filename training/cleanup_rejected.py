#!/usr/bin/env python3
"""
Limpa dados rejeitados e expirados do banco.
Roda todo dia 1 do mês às 4h via cron.
"""

import logging
import os
import psycopg2
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)


def cleanup(database_url: str, retention_days: int = 90):
    db = psycopg2.connect(database_url)
    cur = db.cursor()
    cutoff = datetime.now() - timedelta(days=retention_days)

    # Remove interações rejeitadas antigas
    cur.execute("""
        DELETE FROM training_interactions
        WHERE curator_status = 'rejected'
          AND curated_at < %s
    """, (cutoff,))
    deleted_interactions = cur.rowcount

    # Remove documentos de treino rejeitados antigos
    cur.execute("""
        DELETE FROM training_documents
        WHERE curator_status = 'rejected'
          AND created_at < %s
    """, (cutoff,))
    deleted_docs = cur.rowcount

    # Remove batches de treino já usados há mais de 1 ano
    cur.execute("""
        DELETE FROM training_batches
        WHERE status IN ('deployed', 'rolled_back')
          AND completed_at < %s
    """, (datetime.now() - timedelta(days=365),))
    deleted_batches = cur.rowcount

    # Remove logs de auditoria antigos (180 dias)
    cur.execute("""
        DELETE FROM audit_logs
        WHERE created_at < %s
    """, (datetime.now() - timedelta(days=180),))
    deleted_logs = cur.rowcount

    db.commit()
    db.close()

    log.info(
        f"Limpeza concluída: "
        f"{deleted_interactions} interações, "
        f"{deleted_docs} documentos, "
        f"{deleted_batches} batches, "
        f"{deleted_logs} logs removidos"
    )


if __name__ == '__main__':
    cleanup(
        database_url=os.environ['DATABASE_URL'],
        retention_days=int(os.environ.get('RETENTION_DAYS', '90')),
    )
