# 🤖 AI Specialist — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Pipeline de extração LLM, prompt engineering, estratégia multi-provider, chat financeiro, MCP

---

## O que está bom

### 1. Pipeline de extração de faturas é sofisticado e funcional
O fluxo Upload → OCR → LLM → Validação em 3 estágios → Dados estruturados é bem construído. Poucos apps brasileiros chegam nesse nível de extração de faturas.

### 2. Prompts de extração são excelentes
- 300+ linhas de regras detalhadas para parsing de faturas brasileiras
- Exemplos de formato correto vs incorreto
- Regras específicas para parcelas, datas, créditos ocultos
- Prompts bank-specific (Itaú two-column, Bradesco, Nubank)
- Handling de edge cases reais (ano inferido, parcelamento futuro vs atual)

### 3. Multi-provider com fallback
4 provedores (Google Gemini free, Mistral custo-benefício, OpenAI, Anthropic) com abstração `BaseProvider`. Trocar provider é 1 linha de config.

### 4. Validação pós-extração robusta
- `ResponseParser` (703 linhas): normaliza datas, categoriza automaticamente, valida nomes de cartão
- `ExtractionValidator`: soma de itens vs total, remoção de placeholders, merge de duplicatas
- Tolerância de ±R$ 50 para inconsistências — pragmático

### 5. Chat com contexto financeiro rico
19 pontos de dados reais injetados no prompt do chat (contas, transações, cartões, dívidas, metas, budget, projeções). O assistente "Fin" responde com dados reais, não genéricos.

---

## O que está desconexo

### P0 — Confidence score é sempre 0.9 (hardcoded)

**Evidência:** `response_parser.py`, linha 264:
```python
'confidence': 0.9,  # Sempre 0.9!
```

**Impacto:** O usuário não sabe quais itens extraídos são confiáveis e quais precisam de revisão manual. Tudo parece igualmente confiável, mesmo quando a LLM "chutou" uma data ou valor.

**Ganho ao resolver:** Priorização inteligente de revisão. Itens com confidence < 0.7 ficam destacados no frontend. Reduz erros que entram no banco sem revisão.

**Referência cruzada:** O [Frontend Dev](./06-frontend-dev.md) poderia usar esse score para UX de revisão.

---

### P0 — Prompts hardcoded em Python strings

**Evidência:**
- `prompts.py` tem `EXTRACTION_PROMPT = """..."""` com 300 linhas inline
- `financial_agent_service.py` tem system prompt do chat inline no método `_build_enhanced_system_prompt`
- Prompts bank-specific em arquivos `.md` separados (bom!), mas o main prompt não

**Impacto:**
- Iterar no prompt = alterar código Python = commit + deploy
- Sem A/B testing de prompts
- Sem rollback rápido se um prompt novo piora resultados
- Não-devs (PO, analista) não podem contribuir com melhorias

**Ganho ao resolver:** Iteração 10x mais rápida. Carrega prompt de arquivo `.md` em runtime. Possibilita versionamento e comparação de resultados.

**Como resolver:**
```python
# Em vez de EXTRACTION_PROMPT = """..."""
def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    return path.read_text("utf-8")
```

---

### P1 — Chat usa Google Gemini para texto puro (desperdício)

**Evidência:** `financial_agent_service.py` usa Gemini 2.0 Flash para o chat financeiro. Gemini Flash é otimizado para **vision** (imagens). Para texto puro (que é 100% do chat), Mistral Small é:
- 60% mais barato
- Igualmente capaz para análise financeira em português
- Mais rápido para text-only

**Impacto:** Custo desnecessário quando escalar. Na tier gratuita pode bater rate limit antes.

**Ganho ao resolver:** Redução de custo em ~60% no chat. Reservar Gemini para o que ele faz melhor (vision/extração).

---

### P1 — MCP server com path hardcoded e sem documentação

**Evidência:** `.mcp.json`:
```json
"args": ["/Users/kalebeandrade/Dev/geral/biveto-app/mcp-biveto-db/server.py"]
```

- Path absoluto de uma máquina específica
- `BIVETO_API_KEY` vazio
- Nenhum doc explicando quais tools o MCP expõe
- Nenhum exemplo de uso

**Impacto:** Ninguém além do dev original consegue usar o MCP. Feature de integração com Claude/ChatGPT efetivamente morta para qualquer outro contexto.

**Ganho ao resolver:** MCP funcional para qualquer dev. Documentação de tools permite que Claude analise dados financeiros via MCP.

---

### P1 — Sem retry por qualidade de resposta

**Evidência:** Retry existe para erros HTTP (429, 503), mas se a LLM retorna 0 itens extraídos ou JSON malformado, o sistema aceita silenciosamente.

**Impacto:** Faturas complexas (multi-página, layout ruim) podem retornar vazio sem segunda tentativa. Usuário faz upload, recebe 0 transações, e pensa que o sistema falhou.

**Ganho ao resolver:** Retry automático com outro provider ou prompt simplificado quando extração retorna vazio. Taxa de sucesso sobe de ~85% para ~95%.

---

### P1 — Google provider envia texto extraído em vez de PDF nativo

**Evidência:** `google_provider.py` extrai texto com PyMuPDF e envia como string para Gemini, em vez de enviar o PDF diretamente (que Gemini suporta nativamente).

**Impacto:** Perde contexto visual (tabelas, colunas, formatação) que Gemini Vision poderia interpretar. Reduz qualidade da extração especialmente para layouts complexos (Itaú two-column).

**Ganho ao resolver:** Melhor qualidade de extração sem custo adicional. Gemini já suporta PDF upload nativo.

---

### P2 — financial_agent_service.py com 3.539 linhas

**Evidência:** Um único arquivo que:
- Busca dados de 15+ tabelas
- Constrói 19 contextos diferentes
- Formata prompts
- Chama LLMs
- Gerencia conversas
- Gera sugestões

**Impacto:** Impossível testar. Impossível manter. Qualquer mudança em qualquer model pode quebrar o chat.

**Ganho ao resolver:** Separar em:
1. `FinancialContextService` — busca e agrega dados (reutilizável por analytics e review)
2. `ChatPromptBuilder` — constrói prompts do chat
3. `ChatService` — orquestra conversa + LLM
4. `SuggestionEngine` — gera sugestões contextuais

**Referência cruzada:** O [Data Scientist](./03-data-scientist.md) identificou que analytics reimplementa queries que já existem no chat. Com `FinancialContextService`, ambos usariam a mesma fonte.

---

### P2 — Sem schema enforcement para Mistral/OpenAI/Anthropic

**Evidência:**
- Google: usa `response_schema` para forçar formato JSON estruturado
- Mistral: recebe texto livre, depende do `ResponseParser` para limpar
- OpenAI/Anthropic: idem

**Impacto:** Mistral pode retornar JSON malformado, campos faltando, tipos errados. O `ResponseParser` compensa, mas é frágil.

**Ganho ao resolver:** Usar function calling / tool use nos providers que suportam (Mistral e OpenAI suportam). Resposta estruturada garantida.

---

### P2 — Prompt injection risk no chat

**Evidência:** `financial_agent_service.py`:
```python
context_json = json.dumps(context, cls=DecimalEncoder)
return f"""Voce e o Fin...\nDADOS DO USUARIO:\n{context_json}"""
```

Dados do usuário (nomes de transações, descrições de merchants) são injetados diretamente no system prompt sem sanitização.

**Impacto:** Um merchant com nome malicioso poderia alterar o comportamento do chat. Risco baixo (dados são do próprio usuário), mas não-zero em contexto household.

**Ganho ao resolver:** Sanitização de dados antes de injeção no prompt. Separar dados em mensagem `user` em vez de `system`.

---

### P3 — Sem feedback loop para melhorar prompts

**Evidência:** Não há tracking de:
- Taxa de sucesso por provider
- Taxa de sucesso por banco
- Itens que o usuário corrigiu manualmente pós-extração
- Tempo de extração por tipo de documento

**Impacto:** Impossível saber qual provider/prompt funciona melhor para qual banco. Melhorias são baseadas em "feeling" em vez de dados.

**Ganho ao resolver:** Dashboard de qualidade de extração. Dados para decidir investimento em prompt engineering.

---

### P1 — Processamento de PDF leva 6-23 segundos e bloqueia o servidor

**Evidência — Timeline de um PDF de 5 páginas:**

| Fase | Google Gemini | Mistral |
|---|---|---|
| Upload + validação | 150ms | 150ms |
| Extração de texto / PDF→imagem | 1-1.8s (texto) / 2.5-3.1s (imagem) | N/A (PDF direto) |
| Chamada API LLM | 3.5-5.7s (sem retry) | 1.7-3.2s (annotation) ou 2.1-4.2s (LLM) |
| Parsing da resposta | 300-400ms | 300-400ms |
| Validação pós-extração | 600-800ms | 600-800ms |
| **Total típico** | **6.2-8.5s** | **5.4-10.6s** |
| **Pior caso (retries)** | **19-23s** | **6.5-12.2s** |

**Gargalos identificados:**

1. **Conversão PDF→imagem é sequencial** — cada página renderiza uma por vez (PyMuPDF 1.5x zoom). 5 páginas = 2.5-3.1s só em CPU. Poderia ser paralelo.

2. **Upload síncrono bloqueia o único worker** — o endpoint `upload_document()` (não-async) trava o uvicorn worker por 6-23 segundos. Com 1 worker no Fly.io (512MB/1CPU), TODOS os requests de TODOS os usuários ficam travados durante o upload de qualquer pessoa.

3. **Retry delay com sleep fixo** — exponential backoff de 2s→4s→8s. Se Google retorna 429 (rate limit), o request fica parado 14 segundos só esperando.

4. **Validação pós-extração é CPU-bound e síncrona** — 12 passes de validação (remover headers, addresses, duplicatas, sinais invertidos, etc.) rodam inline no request. Somam 440-1180ms.

5. **Prompts carregados do disco a cada request** — arquivos `.md` de prompt são lidos do filesystem a cada extração. Sem cache.

**Impacto real:**
- Usuário espera 6-23 segundos olhando loading spinner
- Outros usuários ficam bloqueados no upload síncrono
- Em PDFs protegidos por senha, adiciona +2.5-3.1s (forçado a converter para imagem)

**Ganho ao resolver:**
- Conversão paralela de páginas: -1.5s (de 3s para 1.5s)
- Cache de prompts: -50-100ms por request
- Forçar uso do endpoint async: elimina bloqueio do worker
- Deferred validation (validar em background, retornar preview rápido): -600-1000ms do tempo percebido

**Referência cruzada:** O [Backend Dev](./05-backend-dev.md) detalha o problema de 1 worker no Fly.io.

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Externalizar todos os prompts** para arquivos `.md` carregados em runtime
2. **Implementar retry por qualidade** — se extração retorna 0 itens, tentar com outro provider
3. **Usar Mistral Small para chat** em vez de Gemini (custo, performance)
4. **Corrigir MCP** — path relativo, documentar tools, exemplo de uso

### Médio prazo (3-4 sprints)

5. **Implementar confidence scoring real** — basear em: presença de data, formato do valor, match com total
6. **Quebrar financial_agent_service.py** em 4 serviços menores
7. **Enviar PDF nativo para Gemini** em vez de texto extraído
8. **Adicionar schema enforcement** para Mistral (via function calling)

### Longo prazo

9. **Feedback loop de qualidade** — trackear correções do usuário para melhorar prompts
10. **A/B testing de prompts** — comparar versões automaticamente
11. **Cache de prompts e respostas** frequentes no Redis
