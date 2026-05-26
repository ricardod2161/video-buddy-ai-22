"""Seleção de clipes via Lovable AI Gateway (Gemini 3 Flash + tool calling)."""
from __future__ import annotations
import os
import json
import httpx

GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions"
MODEL = "google/gemini-3-flash-preview"

SYSTEM = """Você é um editor viral especialista em cortes para TikTok, Reels e Shorts.
Analise a transcrição com timestamps e escolha os MELHORES momentos que tem maior chance de viralizar.
Critérios: hook forte nos primeiros 3s, emoção, polêmica, conhecimento útil, humor, storytelling.
Cada clipe deve ter entre 15s e 60s. NÃO corte no meio de uma frase.
Devolva entre 5 e {max_clips} clipes, ordenados por potencial viral (maior score primeiro)."""


def select_clips(transcript: dict, max_clips: int = 10) -> list[dict]:
    key = os.environ["LOVABLE_API_KEY"]
    # compacta a transcrição: 1 linha por segmento
    lines = [f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in transcript["segments"]]
    transcript_text = "\n".join(lines)
    # trunca se enorme (gemini-3-flash aguenta MUITO, mas custa)
    if len(transcript_text) > 60000:
        transcript_text = transcript_text[:60000] + "\n…[truncado]"

    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM.format(max_clips=max_clips)},
            {"role": "user", "content": f"Idioma: {transcript['language']}\n\nTranscrição com timestamps (segundos):\n{transcript_text}"},
        ],
        "tools": [{
            "type": "function",
            "function": {
                "name": "pick_clips",
                "description": "Retorna os melhores momentos para virar shorts virais.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "clips": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title":  {"type": "string", "description": "Título curto e chamativo, máx 80 chars"},
                                    "start_sec": {"type": "number"},
                                    "end_sec":   {"type": "number"},
                                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                                    "hashtags": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
                                    "virality_reason": {"type": "string", "description": "Por que esse trecho viraliza, máx 200 chars"},
                                    "transcript": {"type": "string", "description": "Trecho falado nesse intervalo"},
                                },
                                "required": ["title", "start_sec", "end_sec", "score", "hashtags", "virality_reason"],
                                "additionalProperties": False,
                            },
                        }
                    },
                    "required": ["clips"],
                    "additionalProperties": False,
                },
            },
        }],
        "tool_choice": {"type": "function", "function": {"name": "pick_clips"}},
    }
    with httpx.Client(timeout=120) as client:
        r = client.post(GATEWAY, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=body)
        if r.status_code == 402:
            raise RuntimeError("Lovable AI sem créditos (402)")
        if r.status_code == 429:
            raise RuntimeError("Lovable AI rate-limited (429)")
        r.raise_for_status()
        data = r.json()
    tool_calls = data["choices"][0]["message"].get("tool_calls") or []
    if not tool_calls:
        raise RuntimeError("IA não devolveu tool call")
    args = json.loads(tool_calls[0]["function"]["arguments"])
    return args["clips"][:max_clips]
