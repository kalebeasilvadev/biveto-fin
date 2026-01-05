# Refinamento Técnico — App PF de Controle Financeiro Inteligente (Mobile + Web)

> Documento técnico robusto e criterioso, cobrindo **frontend + backend Python + processamento de documentos + analytics**, com foco em **lançamento 1 toque**, **IA/visão**, **levez** e **qualidade**.

---

## 1) Requisitos técnicos (resumo)
### Funcionais
- Captura de documentos (foto/upload PDF/imagem).
- Processamento assíncrono: OCR/parse → extração estruturada.
- Lançamento com revisão rápida (1 toque).
- Aprendizado por correção (regras por usuário).
- Painéis e insights (drivers, vazamentos, recorrência, comparativos).
- Exportação e auditoria.

### Não funcionais
- Privacidade/segurança (dados financeiros).
- Alta confiabilidade: confiança por campo + evidências.
- Performance e consumo mínimo de recursos (regra/caching/assíncrono).
- Observabilidade (métricas de qualidade e custo por etapa).

---

## 2) Arquitetura lógica (agnóstica de infraestrutura)
### 2.1 Componentes
1) **Frontend (Mobile + Web)**
   - App cross-platform (Flutter ou RN+Web) com foco em câmera, offline e UX rápido.
2) **API Backend (Python)**
   - FastAPI: autenticação, transações, documentos, analytics.
3) **Pipeline assíncrono (Workers)**
   - Jobs para OCR, parse PDF, classificação e enriquecimento.
4) **Document Intelligence**
   - Extração estruturada, evidências (bbox/página/trecho), confiança por campo.
5) **Rules & Personalization**
   - Regras determinísticas por usuário + aprendizado por correção.
6) **Analytics & Insights**
   - Agregações, recorrência, detecção de vazamentos, drivers e recomendações.
7) **Persistência**
   - Postgres (transações, regras, auditoria) + object storage (documentos) + cache (Redis).

### 2.2 Separação essencial
- **API** deve ficar sempre leve (I/O e persistência).
- **Workers** fazem tudo que é pesado.
- Isso reduz latência e custo e melhora escalabilidade.

---

## 3) Frontend (Mobile + Web) — arquitetura, telas e performance

### 3.1 Arquitetura de UI
**Recomendação de padrão**
- Clean Architecture / MVVM-like:
  - `presentation/` (telas + componentes)
  - `domain/` (casos de uso, entidades)
  - `data/` (repos, API, cache)
- Componentização forte: botões, cartões, gráficos, inputs, estados (loading/empty/error).

**Gerenciamento de estado**
- Deve suportar:
  - fluxo de upload e status de job,
  - cache local de transações e categorias,
  - atualização incremental do dashboard.

### 3.2 UX do “lançamento 1 toque” (requisitos técnicos)
- **Tela de captura**
  - detecção de borda/recorte, rotação automática, compressão adaptativa.
- **Envio resiliente**
  - upload com retry, suporte a “retomar” (se conexão cair).
- **Tela de revisão**
  - “card” com 3 campos primários: Valor | Categoria | Conta
  - confiança por campo (sem forçar edição quando ok).
- **Fila/Status**
  - o app nunca “trava”: mostra progresso e permite sair/voltar.
  - notificação local quando processamento terminar.

### 3.3 Offline-first (para reduzir fricção e custo)
- Permitir:
  - criar lançamento manual offline,
  - enfileirar uploads e enviar quando tiver rede.
- Cache local:
  - últimas categorias, merchants, regras.
- Sincronização:
  - incremental (delta), por período.

### 3.4 Design system e acessibilidade
- Tokens: tipografia, espaçamento, cantos, sombras, cores.
- Contraste alto, fonte escalável, suporte a leitor de tela.
- Layout “thumb-friendly” (inputs e botões grandes).

### 3.5 Observabilidade no frontend
- Métricas:
  - tempo de captura
  - tempo de upload
  - tempo até “cartão de revisão”
  - % de 1-toque (sem editar)
- Log de eventos sem dados sensíveis (IDs apenas).

---

## 4) Backend Python (FastAPI) — camadas e responsabilidades

### 4.1 Camadas recomendadas
- `routers/` (endpoints)
- `schemas/` (Pydantic)
- `services/` (regras de negócio)
- `repositories/` (DB)
- `workers/` (jobs)
- `core/` (auth, config, middlewares)
- `observability/` (logs, métricas, tracing)

### 4.2 Autenticação e autorização
- JWT (access + refresh)
- Rate limit para upload e rotas de processamento
- Segregação por usuário em todas as queries (nunca confiar no client)

### 4.3 API (contratos essenciais)
**Documentos**
- `POST /documents` (multipart): cria documento + job
- `GET /documents/{id}`: status + preview extração
- `POST /documents/{id}/retry`: reprocessar (idempotente)

**Transações**
- `POST /transactions/confirm`: cria transação final com overrides
- `GET /transactions`: filtros completos
- `PATCH /transactions/{id}`: edição

**Analytics/Insights**
- `GET /analytics/summary?month=YYYY-MM`
- `GET /insights?from=&to=`

**Regras**
- `POST /rules/merchant`
- `GET /rules/merchant`
- `DELETE /rules/merchant/{id}`

---

## 5) Pipeline de Document Intelligence (OCR/Parse) — robusto e barato

### 5.1 Estratégia por custo/precisão (camadas)
1) **PDF com texto**: extrair texto/tabelas (sem OCR).
2) **Imagem/PDF escaneado**: OCR.
3) **Regex + validações**: datas, valores, CNPJ, moeda.
4) **Layout heurístico**: detectar “Total”, “Valor”, “Vencimento”, etc.
5) **Enriquecimento**: merchant normalize + categoria sugerida.

### 5.2 Resultado estruturado obrigatório
Cada campo extraído deve carregar:
- `value`
- `confidence` (0..1)
- `source` (PDF_TEXT | OCR | QR | MANUAL)
- `evidence` (trecho, página, bbox quando aplicável)

### 5.3 Policy de “human-in-the-loop”
- Se `amount.confidence < 0.85` → exigir confirmação
- Se `date.confidence < 0.75` → destacar e pedir toque
- Demais campos podem ser opcionais

### 5.4 Deduplicação e cache
- Hash do arquivo + metadados
- Se já processado:
  - reutilizar extração e economizar OCR/IA

---

## 6) Motor de categorização e personalização (sem depender de IA pesada)

### 6.1 Ordem de decisão (importante para custo)
1) Regras do usuário (merchant → categoria)
2) Regras globais (merchant patterns)
3) Similaridade leve (ex.: embeddings + KNN local no backend)
4) LLM fallback (somente quando necessário; com limites)

### 6.2 Aprendizado por correção
Ao confirmar a transação:
- registrar mudanças (categoria, merchant normalizado, tags)
- criar/atualizar `user_merchant_rules` com score e prioridade
- manter auditoria (confiança do usuário)

---

## 7) Analytics & Insights (explicáveis, com cálculo)

### 7.1 Métricas base (MVP)
- gasto por categoria e merchant
- fixo vs variável
- comparativo mês vs média 3 meses
- recorrências simples

### 7.2 Insights “ricos” (V1)
- **Drivers**: quais categorias/merchants explicam a variação
- **Vazamentos**: gastos pequenos e recorrentes que somam alto
- **Projeção**: gasto estimado até o fim do mês por categoria
- **Recomendações**: sempre com cálculo (impacto mensal)

### 7.3 Geração de texto (explicação)
- Preferir template determinístico:
  - evita custo e garante consistência
- LLM opcional:
  - apenas para “resumo em linguagem natural” quando o usuário quiser

---

## 8) Modelo de dados (PostgreSQL) — mínimo robusto

### 8.1 Tabelas principais
- `users`
- `accounts` (carteira, banco, cartão)
- `documents`
- `document_extractions` (versionado)
- `transactions`
- `merchants`
- `categories`
- `user_merchant_rules`
- `insights`
- `transaction_audit`

### 8.2 Auditoria (essencial)
Registrar:
- campo alterado
- valor antigo/novo
- motivo (manual, correção OCR, regra, etc.)

---

## 9) Segurança, privacidade e compliance (mínimo profissional)
- Criptografia em trânsito e em repouso.
- Segregação de dados por usuário.
- Retenção configurável:
  - apagar documento original e manter apenas dados agregados (opcional).
- Logs sem conteúdo sensível (somente IDs).

---

## 10) Qualidade e testes
### 10.1 Testes
- Unit: normalização, regex, regra de categoria, cálculo de insights
- Integration: documento → extração → confirmação
- Golden files: conjunto de exemplos (imagens/PDF) com “expected outputs”
- Regressão: toda mudança no parser valida acurácia

### 10.2 Observabilidade
- Tempo médio por etapa (upload, OCR, parse, classificação)
- % 1-toque
- Taxa de erro por tipo de documento
- Custo estimado por doc (calls OCR/LLM)

---

## 11) Critérios técnicos de aceite (MVP)
- API responde upload em < 1s (cria job, não processa na request).
- Worker processa e retorna extração versionada.
- App recebe status e mostra cartão de revisão.
- Confirmar cria transação idempotente (sem duplicar).
- Dashboard mensal responde com agregações e filtros.

---

## 12) Referências (links em bloco de código)
```text
[BCB] Controle, planejamento e anotação de receitas e despesas (Caderno Gestão de Finanças Pessoais) — turn0search4
[CFPB] Spending tracker e recomendação de rastrear por um mês (Your Money Your Goals) — turn0search16
[OECD] Financial resilience (G20/OECD-INFE report) — turn0search2 / turn0search10
[NFe] Consulta — chave de acesso 44 dígitos (Portal NF-e) — turn0search3
```

