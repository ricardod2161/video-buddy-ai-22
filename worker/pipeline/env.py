"""Helper para ler variáveis de ambiente aceitando aliases (PT/EN).

Permite que o deploy no Render funcione tanto com nomes em inglês quanto
com os nomes traduzidos que o usuário configurou.
"""
from __future__ import annotations
import os

# Mapeia nome canônico -> lista de aliases aceitos
ALIASES: dict[str, list[str]] = {
    "SUPABASE_URL":              ["SUPABASE_URL", "URL_SUPABASE"],
    "SUPABASE_SERVICE_ROLE_KEY": ["SUPABASE_SERVICE_ROLE_KEY", "CHAVE_FUNCAO_SERVICO_SUPABASE"],
    "LOVABLE_API_KEY":           ["LOVABLE_API_KEY", "CHAVE_API_ADORÁVEL", "CHAVE_API_ADORAVEL", "criar_video"],
    "WORKER_SECRET":             ["WORKER_SECRET", "SEGREDO_DO_TRABALHADOR"],
    "WHISPER_MODEL":             ["WHISPER_MODEL", "MODELO_SUSURRADO", "MODELO_SUSSURRADO"],
}


def env(name: str, default: str | None = None) -> str | None:
    """Lê uma variável aceitando qualquer um dos aliases definidos."""
    for alias in ALIASES.get(name, [name]):
        val = os.environ.get(alias)
        if val:
            return val
    return default


def env_required(name: str) -> str:
    """Igual ao env(), mas lança erro claro se faltar."""
    val = env(name)
    if not val:
        aliases = ALIASES.get(name, [name])
        raise RuntimeError(
            f"Variável de ambiente obrigatória ausente: {name} "
            f"(aceita também: {', '.join(a for a in aliases if a != name)})"
        )
    return val
