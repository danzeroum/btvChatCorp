from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TrainerConfig:
    # Banco
    database_url: str = "postgresql://btv:btv@localhost:5432/btvchat"

    # vLLM
    vllm_url: str = "http://localhost:8000"

    # Modelo base
    base_model: str = "meta-llama/Llama-3.3-70B-Instruct"

    # Diretório onde os LoRA adapters são salvos
    lora_dir: str = "/opt/btv/lora_adapters"

    # Mínimo de exemplos para disparar o ciclo
    min_examples: int = 50

    # Threshold de acurácia mínima para deploy (0.0 – 1.0)
    min_accuracy: float = 0.70

    # Quanto pode piorar vs versão anterior antes de rollback
    max_regression: float = 0.05

    # Hiperparâmetros LoRA
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    learning_rate: float = 2e-4
    num_epochs: int = 3
    per_device_batch_size: int = 4
    gradient_accumulation_steps: int = 4
    max_seq_length: int = 4096

    # Auto-approve QA sintéticos com confidence acima deste valor
    auto_approve_threshold: float = 0.85
