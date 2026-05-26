# Clip Forge — Worker

Pipeline Python que faz o trabalho pesado fora do Cloudflare Worker:

1. **Download** do vídeo (yt-dlp) — YouTube, TikTok, Vimeo, Twitch, link direto.
2. **Transcrição** com timestamps (faster-whisper).
3. **Seleção dos melhores momentos** via Lovable AI Gateway (Gemini 3 Flash + tool calling).
4. **Renderização** com FFmpeg em 9:16 / 1:1 / 16:9 / 4:5 + legendas queimadas estilo TikTok.
5. **Upload** dos MP4 finais para Supabase Storage (`videos-output`).
6. **Callbacks** assinados (HMAC) para `/api/public/worker-callback` do app.

---

## Deploy em 5 minutos (Render — recomendado)

1. Suba **só a pasta `worker/`** num repo GitHub novo (ex: `clipforge-worker`).
2. Em [render.com](https://render.com): **New +** → **Web Service** → conecte o repo.
3. Render detecta o `render.yaml` automaticamente. Plano sugerido: **Starter** ($7/mês — free tier dorme e quebra o pipeline).
4. Em **Environment**, preencha:
   - `SUPABASE_URL` — cole de Lovable Cloud → Connectors → Lovable Cloud → URL
   - `SUPABASE_SERVICE_ROLE_KEY` — em Connectors → Lovable Cloud → Service Role Key (não a anon!)
   - `LOVABLE_API_KEY` — me peça com "/secret LOVABLE_API_KEY" se não tiver
   - `WORKER_SECRET` — gere com `openssl rand -hex 32` e cole o mesmo valor no app (próximo passo)
5. Deploy. Anote a URL (ex: `https://clipforge-worker.onrender.com`).
6. **No app Lovable**, adicione os secrets:
   - `BACKEND_URL` = URL do worker
   - `WORKER_SECRET` = mesmo valor do passo 4
   - `PUBLIC_APP_URL` = URL pública do app (ex: `https://project--xxx.lovable.app`)
7. Pronto. Cole um link no /dashboard e veja a mágica.

## Alternativas
- **Railway**: `railway up` na pasta — funciona com o Dockerfile.
- **Fly.io**: `fly launch` na pasta.
- **VPS própria**: `docker build -t clipforge-worker . && docker run -p 8080:8080 --env-file .env clipforge-worker`.

## Local dev

```bash
cd worker
pip install -r requirements.txt
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOVABLE_API_KEY=... WORKER_SECRET=devsecret
uvicorn main:app --reload --port 8080
```

## Como o pipeline é disparado

O app chama `POST {BACKEND_URL}/process` com header `x-signature` (HMAC-SHA256 do body usando `WORKER_SECRET`). O body é:

```json
{ "project_id":"…uuid…", "user_id":"…uuid…", "source_url":"https://youtube.com/…", "callback_url":"https://app.lovable.app/api/public/worker-callback" }
```

Para renderizar um formato específico:
```json
{ "action":"render", "project_id":"…", "clip_id":"…", "render_id":"…", "user_id":"…", "aspect_ratio":"9:16", "callback_url":"…" }
```

O worker responde 202 imediatamente e processa em background, mandando callbacks de progresso.

## Custo aproximado por vídeo de 1h
- Render Starter idle: $7/mês
- Lovable AI (Gemini 3 Flash): ~$0.005 por análise
- Whisper roda local (CPU): tempo, não dinheiro (~1x duração do vídeo no Starter)

Para acelerar transcrição, mude `WHISPER_MODEL=tiny` (rápido, qualidade ok para inglês) ou suba para plano com GPU.
