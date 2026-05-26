"""Worker FastAPI: orquestra download → transcribe → select → render → upload."""
from __future__ import annotations
import os
import hmac
import hashlib
import tempfile
import traceback
from pathlib import Path
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from pydantic import BaseModel, HttpUrl

from pipeline.download import download
from pipeline.transcribe import transcribe
from pipeline.select import select_clips
from pipeline.render import render_clip, ASPECT
from pipeline.storage import upload_clip, callback, supabase
from pipeline.env import env

app = FastAPI()

MAX_CLIPS = int(env("MAX_CLIPS", "10") or "10")


def _verify_signature(secret: str, body: bytes, sig: str | None) -> bool:
    if not sig:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(expected, sig)
    except Exception:
        return False


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
async def process(request: Request, bg: BackgroundTasks):
    secret = env("WORKER_SECRET")
    if not secret:
        raise HTTPException(500, "WORKER_SECRET not set")
    raw = await request.body()
    if not _verify_signature(secret, raw, request.headers.get("x-signature")):
        raise HTTPException(401, "bad signature")
    import json
    payload = json.loads(raw)
    action = payload.get("action", "full")
    if action == "render":
        bg.add_task(_render_one, payload)
    else:
        bg.add_task(_full_pipeline, payload)
    return {"accepted": True}


def _emit(cb: str | None, event: str, **kwargs):
    callback(cb, {"event": event, **kwargs})


def _full_pipeline(payload: dict):
    project_id = payload["project_id"]
    user_id = payload["user_id"]
    source_url = payload["source_url"]
    cb = payload.get("callback_url")

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        try:
            _emit(cb, "project_progress", project_id=project_id, status="downloading", progress=5)
            video_file, info = download(source_url, tmp)
            _emit(cb, "project_progress", project_id=project_id, status="transcribing",
                  progress=25, title=info["title"][:300], duration_sec=info["duration"])

            transcript = transcribe(video_file)
            _emit(cb, "project_progress", project_id=project_id, status="analyzing", progress=55)

            clips = select_clips(transcript, max_clips=MAX_CLIPS)

            # transcript por palavra global para os renders depois
            all_words = []
            for s in transcript["segments"]:
                all_words.extend(s.get("words") or [])

            # guarda mapping clip-order para renderizar 9:16 default depois
            _emit(cb, "clips_ready", project_id=project_id, user_id=user_id, clips=clips)

            # auto-render 9:16 do top-3 para feedback rápido (idempotente via upsert no app callback?)
            # → Aqui o worker NÃO sabe os clip_id criados (eles são gerados no DB pelo callback).
            #   Então só marca o projeto como done; renders sob demanda partem do botão na UI.
            _emit(cb, "project_progress", project_id=project_id, status="done", progress=100)

            # também salva o video bruto e words para futuros renders
            _persist_source(user_id, project_id, video_file, transcript)
        except Exception as e:
            traceback.print_exc()
            _emit(cb, "project_progress", project_id=project_id, status="failed",
                  progress=0, error_msg=str(e)[:1000])


def _persist_source(user_id: str, project_id: str, local: Path, transcript: dict):
    """Sobe o vídeo fonte + transcript json para o bucket videos-input para reuso em renders."""
    sb = supabase()
    src_key = f"{user_id}/{project_id}/source.mp4"
    with local.open("rb") as f:
        sb.storage.from_("videos-input").upload(src_key, f, {"content-type": "video/mp4", "upsert": "true"})
    import json
    tr_key = f"{user_id}/{project_id}/transcript.json"
    sb.storage.from_("videos-input").upload(
        tr_key, json.dumps(transcript).encode(), {"content-type": "application/json", "upsert": "true"}
    )


def _render_one(payload: dict):
    project_id = payload["project_id"]
    user_id = payload["user_id"]
    clip_id = payload["clip_id"]
    render_id = payload["render_id"]
    aspect = payload["aspect_ratio"]
    cb = payload.get("callback_url")

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        try:
            sb = supabase()
            # baixa source + transcript do bucket
            src_local = tmp / "source.mp4"
            with src_local.open("wb") as f:
                f.write(sb.storage.from_("videos-input").download(f"{user_id}/{project_id}/source.mp4"))
            import json
            transcript = json.loads(sb.storage.from_("videos-input").download(
                f"{user_id}/{project_id}/transcript.json").decode())

            # busca o clip
            clip_row = sb.table("clips").select("start_sec,end_sec").eq("id", clip_id).single().execute()
            start = float(clip_row.data["start_sec"])
            end = float(clip_row.data["end_sec"])

            words = []
            for s in transcript["segments"]:
                for w in (s.get("words") or []):
                    if w["end"] >= start and w["start"] <= end:
                        words.append(w)

            out = tmp / f"clip_{clip_id}_{aspect.replace(':', 'x')}.mp4"
            render_clip(src_local, out, start, end, aspect, words=words)
            url = upload_clip(out, user_id, project_id, out.name)
            _emit(cb, "render_done", render_id=render_id, output_url=url)
        except Exception as e:
            traceback.print_exc()
            _emit(cb, "render_failed", render_id=render_id, error_msg=str(e)[:1000])
