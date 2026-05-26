## Página de Créditos

Criar nova rota `/credits` (protegida) com saldo, histórico de uso e botão de compra.

### 1. Rota e navegação
- Novo arquivo `src/routes/_authenticated.credits.tsx` (autoprotegida pelo layout `_authenticated`).
- Atualizar `src/components/app-sidebar.tsx`: item "Créditos" passa a ser `enabled: true` com `url: "/credits"` (hoje está desabilitado).
- `head()` com title/description próprios.

### 2. Layout da página
Reutiliza o mesmo shell do dashboard (SidebarProvider + AppSidebar + header com `CreditsBadge` + `UserMenu`). Conteúdo principal em três seções:

**a) Card "Saldo atual"**
- Lê `user_credits.amount` via TanStack Query (mesma `queryKey: ["credits"]` do dashboard — reaproveita cache).
- Exibe número grande em destaque, com skeleton no loading.
- Botão primário **"Comprar créditos"** ao lado.

**b) Card "Comprar créditos"** (mock por enquanto)
- Mostra 3 pacotes sugeridos (ex: 10 / 50 / 200 créditos) em cards selecionáveis.
- Botão "Ir para checkout" → ver seção 3.

**c) Tabela "Histórico de uso"**
- Query na tabela `videos` (mesma RLS já filtra por usuário): `select id, original_url, created_at, status`.
- Colunas: **Data**, **Vídeo** (nome do arquivo), **Status** (reusa `StatusBadge`), **Créditos consumidos** (fixo `−1` por linha, já que cada upload consome 1 crédito via `consume_credit()`).
- Skeleton screens no loading, estado vazio amigável.
- Ordem: `created_at desc`.

### 3. Botão "Comprar créditos" → Stripe Checkout

**Importante:** o projeto ainda não tem Stripe configurado. Precisa decidir o caminho antes de eu implementar:

- **Opção A (recomendada — Lovable Payments):** ativar pagamentos integrados via Stripe pela Lovable (`enable_stripe_payments`). Não exige conta Stripe nem chave API, ambiente de teste é criado automaticamente. Eu então crio os produtos (pacotes de crédito) e o server function de checkout.
- **Opção B (BYOK):** você fornece sua própria `STRIPE_SECRET_KEY`; eu crio um server function `createCheckoutSession` que chama a API do Stripe e devolve a URL.
- **Opção C (stub agora):** botão fica desabilitado com tooltip "em breve" e implementamos checkout numa próxima etapa. A página de Créditos (saldo + histórico) é entregue mesmo assim.

A creditação após pagamento (webhook → incrementa `user_credits.amount`) fica fora do escopo deste plano e entra na etapa do checkout.

### 4. Fora do escopo
- Tabela separada de transações/ledger (por ora derivamos histórico de `videos`).
- Webhook Stripe e fulfilment de créditos.
- Reembolso / créditos expirados.

### Arquivos
- **Novo:** `src/routes/_authenticated.credits.tsx`
- **Novo:** `src/components/credits/purchase-card.tsx` (pacotes)
- **Novo:** `src/components/credits/usage-table.tsx`
- **Editado:** `src/components/app-sidebar.tsx` (habilita item Créditos)

---

**Antes de implementar:** qual opção para o botão de checkout — **A (Lovable Payments)**, **B (sua chave Stripe)** ou **C (stub por enquanto)**?
