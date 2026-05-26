
# Redesign do Dashboard — SaaS Dark + Roxo

Vou refatorar o `/dashboard` num layout SaaS com sidebar fixa, header rico e tabela de vídeos, mantendo toda a lógica atual de upload, créditos e Realtime intactas.

## Mudanças visuais (design tokens)

- Trocar accent atual (verde-lima) por **roxo `#7C3AED`** no `src/styles.css`:
  - `--primary` → roxo, `--ring` → roxo, ajustar `--primary-foreground` para branco.
  - Manter o restante do tema dark near-black.
- Status colors via tokens semânticos já existentes (`success`, `warning`, `destructive`) ajustados:
  - pending → `muted` (cinza)
  - processing → `warning` (âmbar) + `animate-pulse`
  - completed → `success` (verde)
  - failed → `destructive` (vermelho)

## Estrutura de layout

```text
┌────────────┬──────────────────────────────────────────┐
│            │  Header: [créditos badge] [avatar ▾]     │
│  Sidebar   ├──────────────────────────────────────────┤
│  ├ Home    │                                          │
│  ├ Vídeos  │   Dropzone (com barra de progresso)      │
│  ├ Crédit. │                                          │
│  └ Config. │   Tabela: Nome | Status | Data | Ações   │
│            │                                          │
└────────────┴──────────────────────────────────────────┘
```

### Sidebar
- Usar `shadcn/ui Sidebar` (`collapsible="icon"`) — já listado nas dependências do template.
- Itens: Home, Vídeos, Créditos, Configurações (ícones lucide: `Home`, `Video`, `Coins`, `Settings`).
- Por enquanto só Vídeos/Home têm rota real; os outros itens ficam como placeholder (`#`) com tooltip "Em breve" — sem criar rotas novas para não sair do escopo do redesign.
- Novo `src/components/app-sidebar.tsx`.

### Header
- Badge de créditos restantes (chip arredondado, ícone `Coins`, número grande, cor roxa quando >0, vermelha quando 0).
- Avatar (`shadcn DropdownMenu` + `Avatar`) com iniciais do email. Menu: email, separador, **Sair** (chama `supabase.auth.signOut`).

### Dropzone com progresso
- Substituir `<label>` atual por dropzone real com drag handlers (`onDragOver` / `onDrop`).
- Barra de progresso animada usando o `onUploadProgress`-equivalente do Supabase Storage: usar `upload()` com a opção `duplex` + medir via XHR não está disponível na SDK; vou usar um **progresso simulado** suave (de 0→90% durante upload, salta para 100% ao terminar) — feedback visual claro sem dependência de API não suportada. Componente: `<Progress>` do shadcn (roxo).
- Estados: idle / dragging (borda roxa + glow) / uploading (barra) / success (flash verde).

### Tabela
- `shadcn Table`: colunas **Nome**, **Status**, **Data**, **Ações**.
- Status: componente `<StatusBadge status={...} />` retornando `<Badge>` com classes condicionais e ícone (`Clock`/`Loader2`/`CheckCircle2`/`XCircle`).
- Ações: botão **Download** (`<Button variant="outline" size="sm">`) com `disabled={status !== "completed" || !output_url}`. Link abre `output_url` em nova aba.
- Nome = arquivo extraído de `original_url` (`split("/").pop()`).
- Data formatada `pt-BR`.

### Skeleton screens
- Enquanto `videos.isLoading` ou `credits.isLoading`: renderizar `<Skeleton>` (shadcn) — 5 linhas na tabela e barras no badge de créditos.
- Substitui o "Carregando…" textual atual.

## Comportamento (preservado)

- Upload: mesmo fluxo atual (`storage.upload` → `rpc("consume_credit")` → `insert videos` → `triggerProcessing`).
- Realtime: mesma subscription em `videos` filtrada por `user_id`.
- Erros: `toast` (sonner) como hoje.
- Sem mudanças em DB, server functions ou auth.

## Arquivos

**Novos**
- `src/components/app-sidebar.tsx` — sidebar com 4 itens
- `src/components/dashboard/credits-badge.tsx`
- `src/components/dashboard/user-menu.tsx` (avatar + dropdown)
- `src/components/dashboard/upload-dropzone.tsx` (drag&drop + progresso)
- `src/components/dashboard/videos-table.tsx`
- `src/components/dashboard/status-badge.tsx`

**Editados**
- `src/routes/_authenticated.dashboard.tsx` — passa a orquestrar os componentes acima dentro do `SidebarProvider`
- `src/styles.css` — troca `--primary` para roxo `#7C3AED` (oklch equivalente)

**Dependências shadcn**: verificar/instalar via CLI shadcn se faltarem `sidebar`, `dropdown-menu`, `avatar`, `table`, `progress`, `skeleton`, `badge`, `button`, `tooltip`.

## Fora do escopo

- Criar rotas reais para Créditos / Configurações (item de menu fica como placeholder).
- Mexer em login, server functions, schema ou triggerProcessing.
- Player de vídeo / preview no clique.

Confirmar?
