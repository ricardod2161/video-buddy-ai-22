"""Download de vídeo via yt-dlp."""
from __future__ import annotations
import os
import subprocess
from pathlib import Path


def download(source_url: str, out_dir: Path) -> tuple[Path, dict]:
    """Baixa o vídeo e retorna (caminho_arquivo, info_dict).

    info_dict tem 'title', 'duration' (segundos).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(out_dir / "source.%(ext)s")

    cmd = [
        "yt-dlp",
        "-f", "bv*[height<=1080]+ba/b[height<=1080]/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "--no-warnings",
        "--print-json",
        "-o", out_template,
        source_url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60 * 30)
    if proc.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {proc.stderr[-500:]}")

    import json
    info = json.loads(proc.stdout.strip().splitlines()[-1])
    # localiza o arquivo final
    for ext in ("mp4", "mkv", "webm"):
        f = out_dir / f"source.{ext}"
        if f.exists():
            return f, {"title": info.get("title", ""), "duration": int(info.get("duration") or 0)}
    raise RuntimeError("output file not found")
