import psutil
import torch
from typing import Optional, Tuple


def get_gpu_info() -> Tuple[Optional[str], Optional[float], Optional[float]]:
    """Retorna (nome, vram_total_gb, vram_used_gb) ou (None, None, None) se sem GPU."""
    if not torch.cuda.is_available():
        return None, None, None
    props = torch.cuda.get_device_properties(0)
    total = props.total_memory / (1024 ** 3)
    used = (props.total_memory - torch.cuda.mem_get_info(0)[0]) / (1024 ** 3)
    return props.name, round(total, 2), round(used, 2)


def get_system_info() -> dict:
    cpu = psutil.cpu_percent(interval=0.1)
    ram = psutil.virtual_memory().used / (1024 ** 3)
    return {"cpu_percent": cpu, "ram_used_gb": round(ram, 2)}
