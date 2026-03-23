# 🖥️ Frontend Dev — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Páginas, estado, alinhamento com API, UX técnica, performance

---

## O que está bom

### 1. Stack moderna e coerente
React 18 + TypeScript strict + Zustand + TanStack Query + Tailwind. Stack leve, performática e com boa DX. Zustand é escolha acertada sobre Redux para este porte de app.

### 2. API layer sofisticada
`api.ts` (980 linhas) com:
- Token refresh pre-emptivo (30s antes de expirar)
- Request queuing durante refresh (evita race condition)
- Tradução de erros para português (30+ mensagens mapeadas)
- Suporte a túneis (LocalTunnel, Cloudflare)
- Auto-logout em sessão expirada

### 3. PWA completo
Service worker, install prompt com cooldown de 14 dias, pull-to-refresh, update banner, standalone detection. App realmente funciona como app mobile.

### 4. E2E tests com Playwright
25+ specs com Page Object Model, fixtures de auth, testes responsivos, visual regression. Cobertura E2E é impressionante para um projeto deste porte.

### 5. Mobile-first real
Safe area insets, bottom sheets, gesture support, SemicircleFAB para quick actions. Não é apenas responsivo — é pensado para mobile.

### 6. Help system contextual
`HelpButton` + `HelpModal` com conteúdo por página. Dados de ajuda em arquivos de dados dedicados.

---

## O que está desconexo

### P0 — 34 páginas para features que podem não funcionar no backend

**Evidência:** O frontend tem páginas completas para features que dependem de Celery (que provavelmente está morto em prod):

| Página | Feature | Depende de Celery? | Status provável |
|---|---|---|---|
| Notifications | Centro de notificações | Sim (alerts engine) | Vazio |
| Automations | Regras de automação | Sim (scheduled tasks) | Regras nunca executam |
| WeeklyReview | Revisão semanal | Parcial (alertas) | Funciona parcialmente |
| Achievements | Badges/gamification | Sim (hooks fracos) | Badges nunca concedidos |

**Impacto:** Usuário vê pages que parecem quebradas. "Configurei automação e nada aconteceu." "Não recebo nenhuma notificação." Pior que não ter a feature é ter uma que não funciona.

**Ganho ao resolver:** Ou corrigir o backend (Celery) ou remover/esconder as páginas até que funcione. Experiência honesta.

**Referência cruzada:** [Arquiteto](./01-arquiteto.md) e [Backend Dev](./05-backend-dev.md) detalham o problema do Celery.

---

### P1 — API layer com 980 linhas em arquivo único

**Evidência:** `services/api.ts` tem 28 API groups (authApi, transactionsApi, documentsApi, etc.) tudo num único arquivo de 980 linhas.

**Impacto:**
- Difícil de navegar (scroll infinito)
- Merge conflicts frequentes (todo mundo edita o mesmo arquivo)
- Impossível fazer tree-shaking (todo o API layer é importado junto)

**Ganho ao resolver:** Separar em `services/auth.api.ts`, `services/transactions.api.ts`, etc. Cada módulo importa só o que precisa.

---

### P1 — Sem unit tests no frontend

**Evidência:** 0 testes com Jest/Vitest. Apenas E2E com Playwright.

**Impacto:**
- E2E é lento (minutos vs milissegundos)
- E2E não testa edge cases de components (loading states, error states, empty states)
- Refatoração de componentes sem rede de segurança
- CI não pega regressões em lógica de componente

**Ganho ao resolver:** Testes unitários com Vitest para: stores (authStore, themeStore), hooks customizados (useGamification, usePWAInstall), utilitários de formatação.

---

### P1 — Confidence score do backend não é usado no UI de revisão

**Evidência:** Backend sempre retorna `confidence: 0.9` (hardcoded). Frontend provavelmente não diferencia itens de alta vs baixa confiança na tela de revisão de extração.

**Impacto:** Após upload de fatura, todos os itens extraídos parecem igualmente confiáveis. Usuário pode confirmar dados errados sem perceber.

**Ganho ao resolver:** Destacar itens com confidence < 0.7 em amarelo/vermelho. Usuário revisa com prioridade os itens incertos.

**Referência cruzada:** [AI Specialist](./02-ai-specialist.md) precisa implementar confidence real primeiro.

---

### P2 — Stores com lógica de negócio leak

**Evidência:** `authStore.ts` tem lógica de token expiration checking com buffer de 30 segundos:
```typescript
isTokenExpired: () => {
    const exp = state.tokenExpiration;
    if (!exp) return true;
    return Date.now() >= (exp - 30) * 1000;
}
```

**Impacto:** Lógica de autenticação (quanto buffer usar, como calcular expiração) está no store do frontend em vez de no interceptor HTTP. Duplicação de responsabilidade com o interceptor que já faz refresh automático.

**Ganho ao resolver:** Centralizar lógica de token no interceptor. Store só guarda estado.

---

### P2 — Error messages hardcoded em português no api.ts

**Evidência:**
```typescript
const errorMessages: Record<string, string> = {
    'Invalid credentials': 'Email ou senha incorretos',
    'Email already registered': 'Este email já está cadastrado',
    // ... 30+ mensagens
};
```

**Impacto:** Se quiser suportar inglês ou outro idioma no futuro, precisa refatorar. Para contexto atual (app brasileiro) funciona, mas é tech debt se internacionalização for necessária.

**Ganho ao resolver:** Preparação para i18n. Baixa prioridade dado o público alvo.

---

### P2 — 34 páginas com imports potencialmente pesados

**Evidência:** 34 páginas + 11 diretórios de componentes + Recharts para gráficos. Sem evidência de lazy loading por rota (React.lazy/Suspense).

**Impacto:** Bundle inicial pode ser grande. First Contentful Paint pode ser lento em mobile. Recharts é particularmente pesado.

**Ganho ao resolver:** Code splitting por rota. Lazy load de Recharts. Bundle ~50% menor. FCP ~2x mais rápido.

---

### P2 — Upload form data type com muitos campos opcionais

**Evidência:** `TransactionFormData` tem: amount, date, account_id, destination_account_id, category_id, merchant_name, description, type, installment info, ownership_type, recurring_frequency, split_rule_ids[].

**Impacto:** Formulário complexo para criar transação manualmente. UX pode ser intimidadora para usuário casual. Muitos campos opcionais que confundem.

**Ganho ao resolver:** Progressive disclosure — mostrar campos avançados só quando necessário. Formulário base simples (valor, data, categoria, conta).

---

### P3 — Vite proxy para /api mas backend serve frontend também

**Evidência:**
- `vite.config.ts`: proxy `/api` → `localhost:8000`
- `main.py`: serve frontend build estático + SPA catch-all
- `Dockerfile`: multi-stage build copia frontend para backend

**Impacto em dev:** Funciona mas é confuso. Dev precisa saber que em dev usa Vite proxy, em prod o backend serve o frontend.

**Ganho ao resolver:** Documentar claramente os dois modos no GETTING_STARTED.md.

---

### P3 — ESLint config não encontrada

**Evidência:** `package.json` tem `eslint` nas devDependencies e script `npm run lint`, mas não encontrei `.eslintrc.*` no frontend root.

**Impacto:** Config pode estar no `package.json` (funciona) ou usando defaults. Regras de lint podem não estar customizadas para o projeto.

**Ganho ao resolver:** Menor prioridade. Verificar se `npm run lint` funciona corretamente.

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Esconder páginas de features inoperantes** — ou corrigir backend (Celery) ou mostrar estado "em breve" em Notifications, Automations, Achievements
2. **Lazy loading por rota** — React.lazy + Suspense para todas as páginas
3. **Separar api.ts** em múltiplos arquivos por domínio

### Médio prazo (3-4 sprints)

4. **Adicionar Vitest** — testes unitários para stores, hooks, e utilitários
5. **Implementar UI de confidence** — quando backend tiver score real, destacar itens incertos
6. **Code splitting do Recharts** — lazy import só nas páginas que usam gráficos
7. **Progressive disclosure** no formulário de transação

### Longo prazo

8. **Preparar para i18n** — extrair strings para arquivos de tradução
9. **Storybook** para componentes compartilhados (se time crescer)
