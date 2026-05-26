"""Renderização FFmpeg: corte + reframe + legendas estilo viral burned-in."""
from __future__ import annotations
import subprocess
from pathlib import Path

ASPECT = {
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
    "16:9": (1920, 1080),
    "4:5":  (1080, 1350),
}


def _ass_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t - h * 3600 - m * 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _make_ass(words: list[dict], start_sec: float, end_sec: float, width: int, height: int) -> str:
    """Gera um ASS com palavra-por-palavra estilo TikTok (palavra atual em amarelo)."""
    # divide em frases curtas (~3-5 palavras)
    chunks: list[list[dict]] = []
    cur: list[dict] = []
    for w in words:
        if w["start"] < start_sec or w["end"] > end_sec:
            continue
        cur.append(w)
        if len(cur) >= 4 or w["word"].endswith((".", "!", "?", ",")):
            chunks.append(cur); cur = []
    if cur: chunks.append(cur)

    font_size = max(48, int(height * 0.06))
    margin_v = int(height * 0.22)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: V,DejaVu Sans,{font_size},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,5,2,2,40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for chunk in chunks:
        c_start = chunk[0]["start"] - start_sec
        c_end = chunk[-1]["end"] - start_sec
        # para cada palavra, gera 1 dialogue com ela em amarelo
        for i, w in enumerate(chunk):
            w_start = w["start"] - start_sec
            w_end = w["end"] - start_sec
            parts = []
            for j, ww in enumerate(chunk):
                txt = ww["word"].replace("{", "(").replace("}", ")")
                if j == i:
                    parts.append(r"{\c&H00FFFF&\b1}" + txt + r"{\c&HFFFFFF&\b1}")
                else:
                    parts.append(txt)
            line = " ".join(parts)
            events.append(
                f"Dialogue: 0,{_ass_time(max(0, w_start))},{_ass_time(max(0, w_end))},V,,0,0,0,,{line}"
            )
    return header + "\n".join(events) + "\n"


def render_clip(
    source: Path,
    out_path: Path,
    start_sec: float,
    end_sec: float,
    aspect: str,
    words: list[dict] | None = None,
) -> Path:
    w, h = ASPECT[aspect]
    duration = max(1.0, end_sec - start_sec)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # reframe: scale para preencher altura, crop central
    vf_parts = [
        f"scale=-2:{h}:force_original_aspect_ratio=increase",
        f"crop={w}:{h}",
    ]

    ass_path: Path | None = None
    if words:
        ass = _make_ass(words, start_sec, end_sec, w, h)
        ass_path = out_path.with_suffix(".ass")
        ass_path.write_text(ass, encoding="utf-8")
        # escapa para libavfilter
        ass_escaped = str(ass_path).replace(":", r"\:").replace("'", r"\'")
        vf_parts.append(f"ass='{ass_escaped}'")

    vf = ",".join(vf_parts)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", str(source),
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(out_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60 * 15)
    if ass_path and ass_path.exists():
        ass_path.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr[-500:]}")
    return out_path
