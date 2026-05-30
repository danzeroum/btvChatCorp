import os
from dataclasses import dataclass, field


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Variável de ambiente obrigatória não definida: {name}")
    return value


@dataclass
class TrainerConfig:
    # Banco — obrigatório, sem default hardcoded (credenciais nunca no código)
    database_url: str = field(default_factory=lambda: _require_env("DATABASE_URL"))

    # vLLM
    vllm_url: str = field(default_factory=lambda: os.getenv("VLLM_URL", "http://localhost:8000"))

    # Modelo base
    base_model: str = field(
        default_factory=lambda: os.getenv("BASE_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
    )

    # Diretório onde os LoRA adapters são salvos
    lora_dir: str = field(default_factory=lambda: os.getenv("LORA_DIR", "/opt/btv/lora_adapters"))

    # Mínimo de exemplos para disparar o ciclo
    min_examples: int = field(default_factory=lambda: int(os.getenv("TRAINER_MIN_EXAMPLES", "50")))

    # Threshold de acurácia mínima para deploy (0.0 – 1.0)
    min_accuracy: float = field(
        default_factory=lambda: float(os.getenv("TRAINER_MIN_ACCURACY", "0.70"))
    )

    # Quanto pode piorar vs versão anterior antes de rollback
    max_regression: float = field(
        default_factory=lambda: float(os.getenv("TRAINER_MAX_REGRESSION", "0.05"))
    )

    # Hiperparâmetros LoRA
    lora_r: int = field(default_factory=lambda: int(os.getenv("LORA_R", "16")))
    lora_alpha: int = field(default_factory=lambda: int(os.getenv("LORA_ALPHA", "32")))
    lora_dropout: float = field(default_factory=lambda: float(os.getenv("LORA_DROPOUT", "0.05")))
    learning_rate: float = field(default_factory=lambda: float(os.getenv("LEARNING_RATE", "2e-4")))
    num_epochs: int = field(default_factory=lambda: int(os.getenv("NUM_EPOCHS", "3")))
    per_device_batch_size: int = field(
        default_factory=lambda: int(os.getenv("PER_DEVICE_BATCH_SIZE", "4"))
    )
    gradient_accumulation_steps: int = field(
        default_factory=lambda: int(os.getenv("GRADIENT_ACCUMULATION_STEPS", "4"))
    )
    max_seq_length: int = field(default_factory=lambda: int(os.getenv("MAX_SEQ_LENGTH", "4096")))

    # Auto-approve QA sintéticos com confidence acima deste valor
    auto_approve_threshold: float = field(
        default_factory=lambda: float(os.getenv("AUTO_APPROVE_THRESHOLD", "0.85"))
    )
