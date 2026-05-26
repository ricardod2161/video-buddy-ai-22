"""Upload para Supabase Storage e callback assinado para o app."""
from __future__ import annotations
import os
import json
import hmac
import hashlib
import httpx
from pathlib import Path
from supabase import create_client, Client


def supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def upload_clip(local: Path, user_id: str, project_id: str, name: str) -> str:
    """Sobe para bucket videos-output e retorna URL assinada (1 ano)."""
    sb = supabase()
    key = f"{user_id}/{project_id}/{name}"
    with local.open("rb") as f:
        sb.storage.from_("videos-output").upload(
            key, f, {"content-type": "video/mp4", "upsert": "true"}
        )
    signed = sb.storage.from_("videos-output").create_signed_url(key, 60 * 60 * 24 * 365)
    return signed["signedURL"] if "signedURL" in signed else signed["signedUrl"]


def callback(url: str | None, payload: dict) -> None:
    if not url:
        print("[callback] skipped (no callback_url):", payload.get("event"))
        return
    secret = os.environ["WORKER_SECRET"]
    body = json.dumps(payload, separators=(",", ":"))
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    try:
        with httpx.Client(timeout=15) as c:
            r = c.post(url, content=body, headers={
                "Content-Type": "application/json",
                "x-signature": sig,
            })
            if r.status_code >= 300:
                print(f"[callback] {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"[callback] error: {e}")
