import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras
import requests

from .config import TrainerConfig

logger = logging.getLogger(__name__)


class ContinuousTrainer:
    """
    Orquestra o ciclo completo de fine-tuning contínuo:

    1. COLETA  — busca interações aprovadas, correções e QA sintéticos
    2. FORMATA — converte para JSONL no formato Alpaca (Unsloth compatível)
    3. TREINA  — LoRA incremental sobre a versão anterior via Unsloth
    4. AVALIA  — roda benchmark fixo do workspace; mede acurácia por keywords
    5. DEPLOY  — hot-swap no vLLM (sem reiniciar servidor) ou rollback
    """

    def __init__(self, workspace_id: str, config: Optional[TrainerConfig] = None):
        self.workspace_id = workspace_id
        self.cfg = config or TrainerConfig()
        self.db = psycopg2.connect(
            self.cfg.database_url,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        self.lora_dir = Path(self.cfg.lora_dir)
        self.lora_dir.mkdir(parents=True, exist_ok=True)

    # ─────────────────────────────────────────────────────────────────────────
    # ESTÁGIO 1 — Coleta
    # ─────────────────────────────────────────────────────────────────────────

    def collect_approved_data(self) -> list[dict]:
        """
        Coleta 3 fontes de dados aprovados:
        - Tipo 1: Thumbs up (aprovação implícita) — até 500 exemplos
        - Tipo 2: Correções manuais (ouro) — até 200, peso dobrado
        - Tipo 3: QA sintéticos aprovados de documentos — até 300
        """
        cur = self.db.cursor()
        dataset: list[dict] = []

        # Tipo 1: interações com thumbs up aprovadas pelo curador
        cur.execute(
            """
            SELECT user_message, assistant_response, rag_context
            FROM training_interactions
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND user_rating = 'positive'
              AND training_batch_id IS NULL
              AND eligible_for_training = TRUE
            ORDER BY created_at DESC
            LIMIT 500
            """,
            (self.workspace_id,),
        )
        for row in cur.fetchall():
            dataset.append({
                "instruction": row["user_message"],
                "input": "",
                "output": row["assistant_response"],
                "source": "user_approved",
                "weight": 1.0,
            })

        # Tipo 2: correções manuais — maior peso no treino
        cur.execute(
            """
            SELECT user_message, user_correction, rag_context
            FROM training_interactions
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND user_correction IS NOT NULL
              AND training_batch_id IS NULL
            ORDER BY created_at DESC
            LIMIT 200
            """,
            (self.workspace_id,),
        )
        for row in cur.fetchall():
            dataset.append({
                "instruction": row["user_message"],
                "input": "",
                "output": row["user_correction"],  # usa a correção, não a resposta original
                "source": "user_corrected",
                "weight": 2.0,  # peso dobrado
            })

        # Tipo 3: QA sintéticos gerados de documentos novos
        cur.execute(
            """
            SELECT generated_question, generated_answer
            FROM training_documents
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND training_batch_id IS NULL
            ORDER BY created_at DESC
            LIMIT 300
            """,
            (self.workspace_id,),
        )
        for row in cur.fetchall():
            dataset.append({
                "instruction": row["generated_question"],
                "input": "",
                "output": row["generated_answer"],
                "source": "synthetic_from_docs",
                "weight": 1.0,
            })

        logger.info(
            f"[{self.workspace_id}] Coletados {len(dataset)} exemplos "
            f"({sum(1 for d in dataset if d['source']=='user_approved')} aprovados, "
            f"{sum(1 for d in dataset if d['source']=='user_corrected')} correções, "
            f"{sum(1 for d in dataset if d['source']=='synthetic_from_docs')} sintéticos)"
        )
        return dataset

    # ─────────────────────────────────────────────────────────────────────────
    # ESTÁGIO 2 — Formata dataset
    # ─────────────────────────────────────────────────────────────────────────

    def format_dataset(self, dataset: list[dict]) -> Path:
        """
        Salva dataset em JSONL no formato Alpaca compatível com Unsloth/Axolotl.
        Duplica exemplos com peso > 1.0 para simular maior peso.
        """
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        output_path = self.lora_dir / f"dataset_{self.workspace_id}_{ts}.jsonl"

        with open(output_path, "w", encoding="utf-8") as f:
            for item in dataset:
                record = {
                    "instruction": item["instruction"],
                    "input": item.get("input", ""),
                    "output": item["output"],
                }
                # Duplica exemplos de alta qualidade (correções manuais)
                times = 2 if item.get("weight", 1.0) >= 2.0 else 1
                for _ in range(times):
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")

        logger.info(f"[{self.workspace_id}] Dataset salvo: {output_path} ({len(dataset)} exemplos)")
        return output_path

    # ─────────────────────────────────────────────────────────────────────────
    # ESTÁGIO 3 — Treina LoRA incremental
    # ─────────────────────────────────────────────────────────────────────────

    def train_lora(self, dataset_path: Path) -> str:
        """
        Treina LoRA incremental usando Unsloth (2x mais rápido que HuggingFace puro).
        Se já existe um LoRA anterior, faz merge antes de treinar em cima
        (treinamento incremental — sem esquecer o que aprendeu).
        Retorna o nome da nova versão (ex: 'lora_v4').
        """
        from unsloth import FastLanguageModel
        from datasets import load_dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments
        from peft import PeftModel

        current = self._get_current_lora_version()
        version_num = int(current.replace("lora_v", "")) + 1 if current else 1
        new_version = f"lora_v{version_num}"
        output_dir = self.lora_dir / self.workspace_id / new_version
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[{self.workspace_id}] Treinando {new_version} (base: {current or 'base_model'})")

        # Carrega modelo base (4-bit quantizado para caber na H100)
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.cfg.base_model,
            max_seq_length=self.cfg.max_seq_length,
            load_in_4bit=True,
        )

        # Merge com LoRA anterior para treino incremental (não esquece versões passadas)
        prev_lora_path = self.lora_dir / self.workspace_id / current if current else None
        if prev_lora_path and prev_lora_path.exists():
            logger.info(f"[{self.workspace_id}] Fazendo merge com LoRA anterior: {current}")
            model = PeftModel.from_pretrained(model, str(prev_lora_path))
            model = model.merge_and_unload()

        # Adiciona novo LoRA adapter
        model = FastLanguageModel.get_peft_model(
            model,
            r=self.cfg.lora_r,
            lora_alpha=self.cfg.lora_alpha,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            lora_dropout=self.cfg.lora_dropout,
            bias="none",
            use_gradient_checkpointing=True,
        )

        # Carrega dataset JSONL
        raw_dataset = load_dataset("json", data_files=str(dataset_path), split="train")

        def format_alpaca(example):
            """Formata no template Alpaca que o Llama 3 entende."""
            instruction = example["instruction"]
            inp = example.get("input", "")
            output = example["output"]
            if inp:
                text = (
                    f"### Instruction:\n{instruction}\n\n"
                    f"### Input:\n{inp}\n\n"
                    f"### Response:\n{output}"
                )
            else:
                text = f"### Instruction:\n{instruction}\n\n### Response:\n{output}"
            return {"text": text}

        formatted = raw_dataset.map(format_alpaca)

        # Treina
        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=formatted,
            dataset_text_field="text",
            max_seq_length=self.cfg.max_seq_length,
            args=TrainingArguments(
                output_dir=str(output_dir),
                num_train_epochs=self.cfg.num_epochs,
                per_device_train_batch_size=self.cfg.per_device_batch_size,
                gradient_accumulation_steps=self.cfg.gradient_accumulation_steps,
                learning_rate=self.cfg.learning_rate,
                warmup_ratio=0.1,
                lr_scheduler_type="cosine",
                logging_steps=10,
                save_strategy="epoch",
                fp16=True,
                report_to="none",  # sem WandB em produção
            ),
        )
        trainer.train()

        # Salva LoRA + tokenizer
        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))
        logger.info(f"[{self.workspace_id}] {new_version} salvo em {output_dir}")
        return new_version

    # ─────────────────────────────────────────────────────────────────────────
    # ESTÁGIO 4 — Avaliação por benchmark
    # ─────────────────────────────────────────────────────────────────────────

    def evaluate_new_version(self, version: str) -> tuple[bool, float]:
        """
        Avalia o novo LoRA contra o benchmark fixo do workspace.
        Retorna (aprovado, acurácia).
        Aprova se acurácia >= min_accuracy E não regrediu mais que max_regression.
        """
        from unsloth import FastLanguageModel
        from peft import PeftModel

        cur = self.db.cursor()
        cur.execute(
            """
            SELECT question, expected_answer, acceptable_keywords
            FROM evaluation_benchmarks
            WHERE workspace_id = %s AND active = TRUE
            """,
            (self.workspace_id,),
        )
        benchmarks = cur.fetchall()

        if not benchmarks:
            logger.warning(f"[{self.workspace_id}] Sem benchmarks. Aprovando automaticamente.")
            return True, 1.0

        lora_path = self.lora_dir / self.workspace_id / version

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.cfg.base_model,
            max_seq_length=self.cfg.max_seq_length,
            load_in_4bit=True,
        )
        model = PeftModel.from_pretrained(model, str(lora_path))
        FastLanguageModel.for_inference(model)  # 2x mais rápido

        correct = 0
        for bm in benchmarks:
            question = bm["question"]
            keywords = json.loads(bm["acceptable_keywords"]) if bm["acceptable_keywords"] else []

            inputs = tokenizer(
                f"### Instruction:\n{question}\n\n### Response:\n",
                return_tensors="pt",
            ).to(model.device)

            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.1,  # determinístico para avaliação
                do_sample=False,
            )
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)

            if keywords:
                hits = sum(1 for kw in keywords if kw.lower() in response.lower())
                if hits / len(keywords) >= 0.70:
                    correct += 1
            else:
                # Sem keywords: checa se a resposta esperada aparece
                if bm["expected_answer"].lower()[:50] in response.lower():
                    correct += 1

        del model  # libera VRAM

        accuracy = correct / len(benchmarks)
        prev_accuracy = self._get_previous_accuracy()
        passed = (
            accuracy >= self.cfg.min_accuracy
            and accuracy >= prev_accuracy - self.cfg.max_regression
        )

        logger.info(
            f"[{self.workspace_id}] Avaliação {version}: "
            f"{correct}/{len(benchmarks)} ({accuracy:.1%}) | "
            f"prev={prev_accuracy:.1%} | {'APROVADO' if passed else 'REPROVADO'}"
        )
        return passed, accuracy

    # ─────────────────────────────────────────────────────────────────────────
    # ESTÁGIO 5 — Deploy / Rollback
    # ─────────────────────────────────────────────────────────────────────────

    def deploy_new_version(self, version: str) -> None:
        """
        Hot-swap do LoRA no vLLM via API sem reiniciar o servidor (zero downtime).
        Atualiza workspace_ai_config no banco para registrar versão ativa.
        """
        lora_path = str(self.lora_dir / self.workspace_id / version)
        lora_name = f"{self.workspace_id}_{version}"

        # vLLM LoRA load API
        resp = requests.post(
            f"{self.cfg.vllm_url}/v1/load_lora_adapter",
            json={"lora_name": lora_name, "lora_path": lora_path},
            timeout=60,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Falha no deploy: {resp.text}")

        cur = self.db.cursor()
        cur.execute(
            """
            INSERT INTO workspace_ai_config (workspace_id, active_lora_version, lora_path, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (workspace_id) DO UPDATE
            SET active_lora_version = EXCLUDED.active_lora_version,
                lora_path            = EXCLUDED.lora_path,
                updated_at           = NOW()
            """,
            (self.workspace_id, version, lora_path),
        )
        self.db.commit()
        logger.info(f"[{self.workspace_id}] Deploy realizado: {version} ativo")

    # ─────────────────────────────────────────────────────────────────────────
    # Orquestrador principal
    # ─────────────────────────────────────────────────────────────────────────

    def run_training_cycle(self) -> None:
        """
        Executa o ciclo completo.
        Chamado via cron todo domingo às 3h da manhã.
        """
        logger.info(f"[{self.workspace_id}] ===== Início do ciclo de treino =====")
        batch_id = str(uuid.uuid4())

        # 1. Coleta
        dataset = self.collect_approved_data()
        if len(dataset) < self.cfg.min_examples:
            logger.info(
                f"[{self.workspace_id}] Apenas {len(dataset)} exemplos. "
                f"Mínimo: {self.cfg.min_examples}. Pulando."
            )
            return

        # 2. Formata
        dataset_file = self.format_dataset(dataset)

        # 3. Treina
        new_version = self.train_lora(dataset_file)

        # 4. Avalia
        passed, accuracy = self.evaluate_new_version(new_version)

        # 5. Deploy ou rollback
        if passed:
            self.deploy_new_version(new_version)
            self._record_batch(dataset, new_version, batch_id, "deployed", accuracy)
            logger.info(f"[{self.workspace_id}] ===== Ciclo concluído: {new_version} em produção =====")
        else:
            self._record_batch(dataset, new_version, batch_id, "rolled_back", accuracy)
            logger.warning(
                f"[{self.workspace_id}] ===== {new_version} não passou. Rollback. ====="
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _get_current_lora_version(self) -> Optional[str]:
        cur = self.db.cursor()
        cur.execute(
            "SELECT active_lora_version FROM workspace_ai_config WHERE workspace_id = %s",
            (self.workspace_id,),
        )
        row = cur.fetchone()
        return row["active_lora_version"] if row else None

    def _get_previous_accuracy(self) -> float:
        cur = self.db.cursor()
        cur.execute(
            """
            SELECT eval_metrics->>'accuracy' AS accuracy
            FROM training_batches
            WHERE workspace_id = %s AND status = 'deployed'
            ORDER BY completed_at DESC
            LIMIT 1
            """,
            (self.workspace_id,),
        )
        row = cur.fetchone()
        if row and row["accuracy"]:
            return float(row["accuracy"])
        return 0.0  # primeiro treino: não há versão anterior

    def _record_batch(
        self,
        dataset: list[dict],
        version: str,
        batch_id: str,
        status: str,
        accuracy: float,
    ) -> None:
        positive = sum(1 for d in dataset if d["source"] == "user_approved")
        corrected = sum(1 for d in dataset if d["source"] == "user_corrected")
        synthetic = sum(1 for d in dataset if d["source"] == "synthetic_from_docs")
        cur = self.db.cursor()
        cur.execute(
            """
            INSERT INTO training_batches
                (id, workspace_id, base_model, new_lora_version,
                 total_examples, positive_examples, corrected_examples, document_examples,
                 status, eval_metrics, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                batch_id, self.workspace_id, self.cfg.base_model, version,
                len(dataset), positive, corrected, synthetic,
                status, json.dumps({"accuracy": accuracy}),
            ),
        )
        # Marca exemplos usados no batch
        cur.execute(
            """
            UPDATE training_interactions
            SET training_batch_id = %s
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND training_batch_id IS NULL
            """,
            (batch_id, self.workspace_id),
        )
        cur.execute(
            """
            UPDATE training_documents
            SET training_batch_id = %s
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND training_batch_id IS NULL
            """,
            (batch_id, self.workspace_id),
        )
        self.db.commit()
