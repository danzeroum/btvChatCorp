#!/usr/bin/env python3
"""
Continuous Trainer — BTV Chat Corp
Roda semanalmente via cron job.
Ciclo: coleta dados aprovados → formata → treina LoRA → avalia → deploy
"""

import json
import os
from datetime import datetime
from pathlib import Path

import psycopg2


class ContinuousTrainer:
    """
    Fine-tuning incremental com LoRA usando Unsloth/TRL.
    Cada ciclo parte do LoRA anterior (treino incremental).
    """

    def __init__(self, workspace_id: str, config: dict):
        self.workspace_id = workspace_id
        self.config = config
        self.db = psycopg2.connect(config['database_url'])
        self.base_model = config['base_model']  # 'meta-llama/Llama-3.3-70B'
        self.lora_dir = Path(config['lora_dir'])

    def run_training_cycle(self):
        """Ciclo completo: coleta → formata → treina → avalia → deploy"""
        print(f"[{datetime.now()}] Iniciando ciclo de treino para {self.workspace_id}")

        dataset = self.collect_approved_data()
        min_examples = self.config.get('min_examples', 50)

        if len(dataset) < min_examples:
            print(f"Apenas {len(dataset)} exemplos. Mínimo: {min_examples}. Pulando ciclo.")
            return

        train_file = self.format_dataset(dataset)
        new_version = self.train_lora(train_file)
        passed = self.evaluate(new_version)

        if passed:
            self.deploy(new_version)
            self.record_batch(dataset, new_version, status='deployed')
            print(f"✅ LoRA {new_version} deployado com sucesso!")
        else:
            print(f"⚠️ LoRA {new_version} não passou na avaliação. Rollback.")
            self.record_batch(dataset, new_version, status='rolled_back')

    def collect_approved_data(self) -> list[dict]:
        """Coleta 3 tipos de dados aprovados: aprovados, corrigidos e Q&A sintéticos"""
        cursor = self.db.cursor()
        dataset = []

        # TIPO 1: Thumbs up (interações aprovadas)
        cursor.execute("""
            SELECT user_message, assistant_response
            FROM training_interactions
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND user_rating = 'positive'
              AND training_batch_id IS NULL
              AND eligible_for_training = TRUE
            ORDER BY created_at DESC
            LIMIT 500
        """, (self.workspace_id,))

        for row in cursor.fetchall():
            dataset.append({
                "instruction": row[0],
                "input": "",
                "output": row[1],
                "source": "user_approved",
                "weight": 1.0,
            })

        # TIPO 2: Correções manuais (peso dobrado — são mais valiosas)
        cursor.execute("""
            SELECT user_message, user_correction
            FROM training_interactions
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND user_correction IS NOT NULL
              AND training_batch_id IS NULL
            LIMIT 200
        """, (self.workspace_id,))

        for row in cursor.fetchall():
            dataset.append({
                "instruction": row[0],
                "input": "",
                "output": row[1],  # usa CORREÇÃO, não resposta original
                "source": "user_corrected",
                "weight": 2.0,
            })

        # TIPO 3: Q&A sintéticos gerados de documentos
        cursor.execute("""
            SELECT generated_question, generated_answer
            FROM training_documents
            WHERE workspace_id = %s
              AND curator_status = 'approved'
              AND training_batch_id IS NULL
              AND generated_question IS NOT NULL
            LIMIT 300
        """, (self.workspace_id,))

        for row in cursor.fetchall():
            dataset.append({
                "instruction": row[0],
                "input": "",
                "output": row[1],
                "source": "synthetic_from_docs",
                "weight": 1.0,
            })

        print(f"Coletados {len(dataset)} exemplos para treino")
        return dataset

    def format_dataset(self, dataset: list[dict]) -> Path:
        """Converte para formato Alpaca JSONL (compatível com Axolotl/Unsloth)"""
        output_path = self.lora_dir / f"dataset_{datetime.now():%Y%m%d_%H%M}.jsonl"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            for item in dataset:
                formatted = {
                    "instruction": item["instruction"],
                    "input": item.get("input", ""),
                    "output": item["output"],
                }
                f.write(json.dumps(formatted, ensure_ascii=False) + '\n')

        print(f"Dataset salvo: {output_path} ({len(dataset)} exemplos)")
        return output_path

    def train_lora(self, dataset_path: Path) -> str:
        """Treina LoRA incremental usando Unsloth + TRL"""
        from unsloth import FastLanguageModel
        from trl import SFTTrainer
        from transformers import TrainingArguments
        from datasets import load_dataset

        current = self.get_current_lora_version()
        new_version = f"lora_v{int(current.split('v')[1]) + 1}"
        output_dir = self.lora_dir / self.workspace_id / new_version

        print(f"Treinando {new_version} (base: {current})...")

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.base_model,
            max_seq_length=4096,
            load_in_4bit=True,
        )

        # Carrega LoRA anterior como base (treino incremental)
        previous_lora = self.lora_dir / self.workspace_id / current
        if previous_lora.exists():
            from peft import PeftModel
            model = PeftModel.from_pretrained(model, str(previous_lora))
            model = model.merge_and_unload()

        # Configura novo LoRA
        model = FastLanguageModel.get_peft_model(
            model,
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "k_proj", "v_proj",
                            "o_proj", "gate_proj", "up_proj"],
            lora_dropout=0.05,
        )

        dataset = load_dataset('json', data_files=str(dataset_path))

        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=dataset['train'],
            args=TrainingArguments(
                output_dir=str(output_dir),
                num_train_epochs=3,
                per_device_train_batch_size=4,
                gradient_accumulation_steps=4,
                learning_rate=2e-4,
                warmup_ratio=0.1,
                logging_steps=10,
                save_strategy="epoch",
                fp16=True,
            ),
            max_seq_length=4096,
        )

        trainer.train()
        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))

        print(f"✅ Treino concluído: {output_dir}")
        return new_version

    def evaluate(self, version: str) -> bool:
        """Avalia o LoRA contra benchmark fixo do workspace"""
        cursor = self.db.cursor()
        cursor.execute("""
            SELECT question, expected_answer, acceptable_keywords
            FROM evaluation_benchmarks
            WHERE workspace_id = %s AND active = TRUE
        """, (self.workspace_id,))
        benchmarks = cursor.fetchall()

        if not benchmarks:
            print("⚠️ Sem benchmarks definidos. Aprovando automaticamente.")
            return True

        from unsloth import FastLanguageModel
        from peft import PeftModel

        lora_path = self.lora_dir / self.workspace_id / version
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.base_model,
            max_seq_length=4096,
            load_in_4bit=True,
        )
        model = PeftModel.from_pretrained(model, str(lora_path))

        correct = 0
        for question, expected, keywords_json in benchmarks:
            inputs = tokenizer(question, return_tensors="pt").to(model.device)
            outputs = model.generate(**inputs, max_new_tokens=512)
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)

            keywords = json.loads(keywords_json) if keywords_json else []
            matches = sum(1 for kw in keywords if kw.lower() in response.lower())

            if not keywords or matches >= len(keywords) * 0.7:
                correct += 1

        accuracy = correct / len(benchmarks)
        previous_accuracy = self.get_previous_accuracy()

        print(f"Avaliação: {correct}/{len(benchmarks)} ({accuracy:.1%}) | Anterior: {previous_accuracy:.1%}")

        # Aprovado se >= 70% E não piorou mais que 5%
        return accuracy >= 0.7 and accuracy >= (previous_accuracy - 0.05)

    def deploy(self, version: str):
        """Hot-swap do LoRA no vLLM sem reiniciar servidor"""
        import requests

        lora_path = str(self.lora_dir / self.workspace_id / version)

        response = requests.post(
            f"{self.config['vllm_url']}/v1/load_lora_adapter",
            json={
                "lora_name": f"{self.workspace_id}_{version}",
                "lora_path": lora_path,
            },
        )
        response.raise_for_status()

        # Atualiza versão ativa no banco
        cursor = self.db.cursor()
        cursor.execute("""
            UPDATE workspaces
            SET settings = jsonb_set(settings, '{active_lora}', %s)
            WHERE id = %s
        """, (json.dumps(version), self.workspace_id))
        self.db.commit()

        print(f"🚀 LoRA {version} deployado via hot-swap!")

    def record_batch(self, dataset: list[dict], version: str, status: str):
        counts = {
            'approved': sum(1 for d in dataset if d['source'] == 'user_approved'),
            'corrected': sum(1 for d in dataset if d['source'] == 'user_corrected'),
            'synthetic': sum(1 for d in dataset if d['source'] == 'synthetic_from_docs'),
        }
        cursor = self.db.cursor()
        cursor.execute("""
            INSERT INTO training_batches
            (workspace_id, new_lora_version, total_examples,
             positive_examples, corrected_examples, document_examples, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            self.workspace_id, version, len(dataset),
            counts['approved'], counts['corrected'], counts['synthetic'], status,
        ))
        self.db.commit()

    def get_current_lora_version(self) -> str:
        cursor = self.db.cursor()
        cursor.execute("""
            SELECT settings->>'active_lora' FROM workspaces WHERE id = %s
        """, (self.workspace_id,))
        row = cursor.fetchone()
        return row[0] if row and row[0] else 'lora_v0'

    def get_previous_accuracy(self) -> float:
        cursor = self.db.cursor()
        cursor.execute("""
            SELECT eval_metrics->>'accuracy'
            FROM training_batches
            WHERE workspace_id = %s AND status = 'deployed'
            ORDER BY created_at DESC LIMIT 1
        """, (self.workspace_id,))
        row = cursor.fetchone()
        return float(row[0]) if row and row[0] else 0.7


if __name__ == '__main__':
    config = {
        'database_url': os.getenv('DATABASE_URL', 'postgresql://localhost/btvchat'),
        'base_model': os.getenv('BASE_MODEL', 'meta-llama/Llama-3.3-70B'),
        'lora_dir': os.getenv('LORA_DIR', '/models/lora'),
        'vllm_url': os.getenv('VLLM_URL', 'http://localhost:8000'),
        'min_examples': int(os.getenv('MIN_EXAMPLES', '50')),
    }
    workspace_id = os.getenv('WORKSPACE_ID', '')

    trainer = ContinuousTrainer(workspace_id, config)
    trainer.run_training_cycle()
