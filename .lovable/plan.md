# Clip Forge → Clone Opus Clip / Klap

## Arquitetura (por que precisa de um worker externo)

Cloudflare Workers (onde roda o TanStack) **não roda FFmpeg nem yt-dlp** — sem subprocessos, sem binários nativos. Para baixar do YouTube, transcrever e renderizar 9:16 com legendas queimadas, precisamos de um worker Python rodando fora (Render / Railway / Fly.io / VPS).

```text
[Browser]
   │ paste URL
   ▼
[TanStack server fn]  ── insere job (status=queued) ──►  [Supabase DB]
   │                                                       ▲
   │ POST /process (signed)                                │ status/clips
   ▼                                                       │
[Worker Python (Render)]                                   │
  yt-dlp → mp4                                             │
  Whisper (faster-whisper) → segmentos com timestamps      │
  Gemini 3 Flash → escolhe N melhores momentos             │
  FFmpeg → corta + reframe + legenda burned-in             │
  upload para Supabase Storage (videos-output)             │
  PATCH job via service_role ──────────────────────────────┘
```

## O que eu entrego nesta etapa

### 1. Frontend novo (estilo Opus / Klap)
- **/dashboard** vira "New Project": campo grande de URL + botão "Generate Clips". Detecta YouTube / TikTok / Vimeo / Twitch / link direto.
- **/projects/$id**: player do vídeo fonte + grid de clipes gerados. Cada clipe tem:
  - thumbnail, título viral sugerido pela IA, score (0-100), hashtags
  - duração e timestamp (start/end no vídeo original)
  - botões de export por formato: **9:16, 1:1, 16:9, 4:5** (tabs no topo do grid; cada formato re-renderiza ou pré-renderiza)
  - download .mp4 + "copiar legenda" + "copiar hashtags"
- **/projects**: lista de projetos com status (queued / downloading / transcribing / analyzing / rendering / done / failed) e progresso.
- **/credits**: ajusta custo (1 crédito por minuto processado, configurável).
- Realtime via Supabase para status do job e aparição dos clipes.

### 2. Schema novo (migration)
```text
projects        (id, user_id, source_url, source_type, title, duration_sec,
                 status, progress, error_msg, created_at)
clips           (id, project_id, user_id, title, hashtags[], score,
                 start_sec, end_sec, transcript, virality_reason)
clip_renders    (id, clip_id, aspect_ratio, status, output_url,
                 subtitle_style, created_at)         -- 1 render por formato
```
Mantém `user_credits` e `videos-input/output` buckets (renomeia uso). RLS por `user_id` em tudo. GRANTs.

### 3. Server functions (TanStack)
- `createProject({url})` — valida URL, cria row `projects` com `status=queued`, debita crédito estimado (cobra final depois), dispara o worker.
- `requestRender({clipId, aspectRatio})` — enfileira renderização daquele formato.
- `getProject({id})` / `listProjects()` — com RLS.

### 4. Server route pública para o worker callback
`/api/public/worker-callback` — verifica HMAC com `WORKER_SECRET`, recebe updates de progresso, transcript, lista de clipes, URLs renderizadas. Usa `supabaseAdmin`.

### 5. Worker Python (entrego o repo pronto)
Pasta nova `worker/` no projeto com:
- `main.py` (FastAPI), `Dockerfile`, `requirements.txt`, `render.yaml` (deploy 1-clique no Render)
- `pipeline/download.py` (yt-dlp), `pipeline/transcribe.py` (faster-whisper), `pipeline/select.py` (chama Lovable AI Gateway com Gemini 3 Flash + tool calling para devolver clipes estruturados com score), `pipeline/render.py` (FFmpeg: crop reframe + ASS subtitles burned-in com estilo TikTok-like, por formato).
- `README.md` com passo-a-passo: criar conta Render → New Web Service → conectar repo → setar envs (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `WORKER_SECRET`, `CALLBACK_URL`) → deploy.
- Eu **não consigo** fazer o deploy por você; você cola a URL do worker em `BACKEND_URL` (secret no app) e está pronto.

### 6. Limpeza
- Apago `videos` table (substituída por `projects` + `clips`), `videos-table.tsx`, `upload-dropzone.tsx`, fluxo antigo. Migração preserva créditos.

## Decisões técnicas
- **Modelo IA**: `google/gemini-3-flash-preview` via Lovable AI Gateway (sem chave extra).
- **Transcrição**: `faster-whisper` modelo `small` (CPU, suficiente para PT/EN; `medium` se quiser melhor).
- **Estilo de legenda**: 1 estilo "viral" inicial (texto branco, contorno preto, highlight da palavra falada em amarelo, fonte Inter Black) — futuramente expomos editor.
- **Limites**: vídeo fonte até 2h, gera entre 5 e 15 clipes (15-60s cada). Render por formato sob demanda (clique no formato) para economizar tempo/CPU.

## Fora do escopo desta etapa
- Editor visual de legendas (cor, fonte, posição)
- B-roll / zoom automático / face tracking
- Agendamento de post direto no TikTok/YouTube
- Multi-idioma de legenda (só transcreve no idioma original)
- Cobrança real / Stripe (créditos continuam mock)

## Pré-requisitos antes de eu começar a codar
1. **Confirmar** o plano (responder ✅).
2. **Onde vai rodar o worker?** Render (recomendado, free tier roda), Railway, Fly.io ou VPS própria. Eu gero o repo pronto pro escolhido.
3. Depois que aprovar, eu **(a)** rodo a migration (vai pedir aprovação separada), **(b)** reescrevo o frontend, **(c)** crio as server functions + route de callback, **(d)** entrego a pasta `worker/` com instruções. Você sobe o worker (~5min) e cola a URL.

**Pode confirmar e me dizer onde quer hospedar o worker?**