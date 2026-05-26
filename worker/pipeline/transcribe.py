"""Transcrição com timestamps por palavra (faster-whisper)."""
from __future__ import annotations
from pathlib import Path
from faster_whisper import WhisperModel
from .env import env

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        size = env("WHISPER_MODEL", "small") or "small"
        _model = WhisperModel(size, device="cpu", compute_type="int8")
    return _model


def transcribe(audio_path: Path) -> dict:
    """Retorna {'language', 'segments': [{start, end, text, words: [{start,end,word}]}]}."""
    model = _get_model()
    segments_iter, info = model.transcribe(
        str(audio_path),
        word_timestamps=True,
        vad_filter=True,
    )
    segments = []
    for seg in segments_iter:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({"start": float(w.start), "end": float(w.end), "word": w.word.strip()})
        segments.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
            "words": words,
        })
    return {"language": info.language, "segments": segments}
