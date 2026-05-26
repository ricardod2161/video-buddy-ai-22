## Objetivo

Entregar Módulo A + B + disparo do processamento (sem o FastAPI ainda), usando Lovable Cloud + TanStack Start. Substituo a Edge Function do diagrama por um **TanStack server function** chamado logo após o insert do vídeo — mesmo runtime do app, sem stack paralela. Quando o BACKEND_URL existir, é só preencher o secret e o disparo passa a funcionar; até lá, o vídeo fica em `pending` (você pode marcar manualmente para testar realtime).

## Stack e decisões-chave

- **Cloud (Supabase gerenciado)** para Auth, DB, Storage e Realtime.
- **Auth:** email/senha + Google (padrão Cloud). Sem tabela `profiles` (não foi pedida).
- **Sem Edge Functions do Supabase.** O disparo vira um `createServerFn` no TanStack — é o padrão recomendado pelo stack atual.
- **Sem DB webhook / pg_net.** Mais simples e mais visível: chamamos o disparador logo após o insert, do lado cliente, dentro do mesmo fluxo do upload.
- **Realtime** na lista de vídeos: a UI atualiza sozinha quando o FastAPI marcar `status=completed`.

## Schema (ajustes sobre o seu SQL)

Migration única, com correções de segurança que o seu SQL original não tem:

- `user_credits(user_id PK → auth.users, amount int default 10, updated_at)`
  - Trigger `on_auth_user_created` cria 10 créditos ao registrar.
  - `SECURITY DEFINER` da função com `SET search_path = public` (evita CVE clássica de search_path).
  - RLS: policies separadas para `SELECT` e `UPDATE`, ambas `auth.uid() = user_id`. **Sem INSERT/DELETE pelo cliente** (só o trigger cria).
- `videos(id, user_id, original_url, output_url, status default 'pending', error_msg, clips_data jsonb, created_at)`
  - Index `(user_id, status)`.
  - RLS: `SELECT` e `INSERT` por `auth.uid() = user_id`. `UPDATE/DELETE` negados ao cliente (só backend via service_role atualiza status/output).
- `GRANT SELECT, INSERT, UPDATE ON public.user_credits TO authenticated;`
  `GRANT SELECT, INSERT ON public.videos TO authenticated;`
  `GRANT ALL ... TO service_role;` (obrigatório — sem isso o PostgREST devolve permission denied mesmo com RLS).
- **Storage bucket privado** `videos-input` com policies: usuário só lê/escreve dentro de `videos-input/{auth.uid()}/...`.

## Módulos a construir

**Módulo A — Auth + Dashboard**
- Rotas: `/` (landing simples), `/login`, `/_authenticated/dashboard`.
- Layout `_authenticated.tsx` faz o guard via `context.auth.isAuthenticated`.
- Dashboard mostra: créditos restantes, botão de upload, lista de vídeos do usuário com badge de status.

**Módulo B — Upload → Storage → insert pending → disparo**
- Componente de upload (drag & drop, mp4/mov, limite de tamanho).
- Fluxo no clique:
  1. Upload do arquivo para `videos-input/{user_id}/{uuid}.mp4`.
  2. `INSERT` em `videos` com `status='pending'` e `original_url` = caminho no Storage.
  3. Decrementa 1 crédito (RPC `consume_credit()` `SECURITY DEFINER`, atômico, falha se `amount <= 0`).
  4. Chama `triggerProcessing({ jobId })` (server fn — ver abaixo).
- Lista de vídeos com **Supabase Realtime** filtrado por `user_id`: status muda de `pending` → `processing` → `completed/failed` sem refresh.

**Disparo do processamento (substitui a Edge Function)**
- `src/lib/processing.functions.ts` — `triggerProcessing` `createServerFn` POST, protegido por `requireSupabaseAuth`.
- Dentro do handler:
  - Valida que o `videos.id` pertence ao `userId` (via `supabaseAdmin`).
  - Lê `process.env.BACKEND_URL` e `process.env.SHARED_SECRET` (apenas dentro do handler — nunca em escopo de módulo).
  - Se ausentes → retorna `{ queued: false, reason: "backend_not_configured" }` e deixa o vídeo em `pending`. App segue funcionando.
  - Se presentes → `fetch(BACKEND_URL + '/process', { headers: { 'x-secret': SHARED_SECRET }, body: { job_id, file_url (signed URL 1h), user_id } })`.
- O FastAPI, quando existir, atualiza `videos.status/output_url/error_msg` via service_role; a UI recebe via Realtime.

## Secrets

Quando o FastAPI estiver pronto, peço via tool de secrets:
- `BACKEND_URL` (ex.: `https://seu-app.up.railway.app`)
- `SHARED_SECRET` (token compartilhado para o header `x-secret`)

Não precisa agora — o app já roda com `pending` e dá pra testar o Realtime atualizando o status manualmente no Cloud.

## Detalhes técnicos relevantes

- **Bearer attacher**: garantir que `src/start.ts` registra `attachSupabaseAuth` em `functionMiddleware` (necessário para `requireSupabaseAuth` no `triggerProcessing`).
- **`onAuthStateChange`** no `__root.tsx` chama `router.invalidate()` + `queryClient.invalidateQueries()` (evita dados do user anterior após logout).
- **Realtime**: `supabase.channel('videos:user='+uid).on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: 'user_id=eq.'+uid }, ...)` no componente da lista; cleanup no unmount.
- **Signed URL** para o FastAPI baixar o arquivo: gerada com `supabaseAdmin.storage.from('videos-input').createSignedUrl(path, 3600)` dentro do server fn.
- **Idempotência**: o próprio FastAPI já trata (seu código). Do lado Lovable, só não chamamos `triggerProcessing` de novo se o vídeo já existe.

## O que NÃO vai entrar agora

- Módulo D (billing, histórico, upgrade) — fica para depois.
- Player modal com download — entrego um link “Baixar” simples; modal/player completo pode vir num próximo passo.
- Email templates customizados, password reset UI — fluxo padrão Supabase.
- O próprio FastAPI / pipeline de FFmpeg/Whisper/ElevenLabs (fora do Lovable; vive no Railway).

## Direção visual

Sem especificação sua, vou de **tech minimal escuro** (fundo near-black, 1 accent vibrante, tipografia geométrica), apropriado pra ferramenta de processamento de vídeo. Se quiser direções alternativas pra escolher antes de eu construir, me avisa que eu gero 2-3 opções.
