# ⚙️ Backend Dev — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Celery/Redis, async patterns, performance, code quality, segurança de código

---

## O que está bom

### 1. FastAPI async bem utilizado
Routers async, SQLAlchemy async, dependency injection limpa com `Depends()`. O hot path da API é non-blocking de ponta a ponta.

### 2. Dependency injection tipada
```python
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
```
Padrão moderno, type-safe, fácil de mockar em testes.

### 3. Multi-auth: JWT + API Key
Suporte a JWT (30min access + 7d refresh) para web e API Key (`biv_[hex]`) para integrações. API keys com hash SHA256 e tracking de uso.

### 4. Rate limiting implementado
SlowAPI com limites por endpoint. Proteção básica contra abuso.

### 5. Security headers no middleware
HSTS em produção, X-Frame-Options, X-Content-Type-Options. Headers corretos para SPA servida pelo backend.

### 6. Password validation rigorosa
Mínimo 8 chars, uppercase, lowercase, dígito, caractere especial, não está em lista de senhas comuns. Acima da média para apps pessoais.

---

## O que está desconexo

### P0 — Celery/Redis: configurado mas provavelmente morto

**Evidência:**
1. `celery_config.py` configura 8 tasks com beat schedule
2. `docker-compose.yml` — só PostgreSQL, **sem Redis**
3. `fly.toml` — uma única VM de 512MB/1CPU, sem worker process
4. `requirements.txt` — tem `celery` e `redis`, mas sem evidência de uso em prod
5. Fallback no config:
   ```python
   broker=settings.redis_url if hasattr(settings, 'redis_url') else "redis://localhost:6379/0"
   ```
   Se `redis_url` não está configurado, aponta para localhost que não existe em prod.

**Impacto:** Features mortas:
- ❌ Notificações de vencimento de fatura (daily 8am)
- ❌ Alertas de budget estourado (6-hourly)
- ❌ Alertas de limite de cartão (6-hourly)
- ❌ Milestones de metas (2x daily)
- ❌ Alertas de recorrentes (daily 6pm)
- ❌ Alertas de saldo baixo (daily 9:30am)
- ❌ Automações agendadas (hourly)
- ❌ Automações por threshold (6-hourly)

**Ganho ao resolver:** 8 features voltam a funcionar. O app passa de "passivo" para "proativo".

**Opções:**
1. **Adicionar Redis no Fly.io** (~$5/mês) + worker process separado
2. **Migrar para FastAPI BackgroundTasks** + APScheduler (sem Redis, menor overhead)
3. **Usar Fly.io Machines** para executar tasks sob demanda

**Referência cruzada:** O [Arquiteto](./01-arquiteto.md) e [Data Scientist](./03-data-scientist.md) identificaram o mesmo problema.

---

### P0 — Automações auto-desabilitam silenciosamente

**Evidência:** `automation_tasks.py`:
```python
if rule.consecutive_failures >= rule.max_consecutive_failures:
    rule.is_active = False
    rule.auto_disabled_at = datetime.utcnow()
    # Nenhuma notificação ao usuário!
```

**Impacto:** Automação para (ex: "transferir R$500 para poupança todo dia 5") e o usuário só descobre quando perceber que não tem mais dinheiro na poupança.

**Ganho ao resolver:** Notificar quando automação é desabilitada. O usuário pode investigar e reativar.

---

### P1 — Celery tasks criam event loop novo por task

**Evidência:** `automation_tasks.py`:
```python
@shared_task(name="automations.process_scheduled")
def process_scheduled_automations():
    async def _process():
        async with async_session_factory() as session:
            ...
    return asyncio.run(_process())  # Novo event loop!
```

**Impacto:** Cada task Celery cria e destrói um event loop Python. Overhead de ~10-50ms por task. Para 38+ tasks/dia é tolerável, mas para escala é ineficiente.

**Ganho ao resolver:** Usar `asgiref.sync_to_async` ou Celery com worker pool async. Reutiliza event loop.

---

### P1 — `datetime.utcnow()` em todo o codebase

**Evidência:** Múltiplos arquivos usam `datetime.utcnow()` que é timezone-naive.

**Impacto:**
- Python 3.12+ deprecou `utcnow()`
- Mixes de timezone-naive e timezone-aware causam bugs sutis
- Cálculos de "hoje" vs "amanhã" podem errar no horário de Brasília

**Ganho ao resolver:** Usar `datetime.now(timezone.utc)` everywhere. Elimina classe inteira de bugs de data.

---

### P1 — Startup migration bloqueia o boot

**Evidência:** `main.py` no startup:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await migrate_credit_card_transactions()
    yield
```

`migrate_credit_card_transactions()` faz 6 queries raw SQL para sincronizar transações com faturas.

**Impacto:** Se tiver 10.000 transações pendentes, o boot trava por minutos. Health check falha, Fly.io mata e reinicia, loop infinito.

**Ganho ao resolver:** Mover para migration Alembic ou task background pós-boot.

---

### P1 — Upload síncrono trava a API

**Evidência:** Document upload tem 2 endpoints:
- `upload_document()` — síncrono, espera extração LLM completar
- `upload_async()` — assíncrono, retorna imediatamente

**Impacto:** O endpoint síncrono trava o worker uvicorn por 5-30 segundos (tempo da LLM). Com 1 worker no Fly.io (512MB), isso bloqueia TODOS os requests de TODOS os usuários.

**Ganho ao resolver:** Deprecar upload síncrono ou mover extração para background.

**Referência cruzada:** O [AI Specialist](./02-ai-specialist.md) identificou que retry de qualidade agravaria esse problema.

---

### P2 — Zero testes

**Evidência:**
- `backend/tests/` tem apenas `test_auth.py`
- `pytest` provavelmente nem roda (audit report diz que pytest_asyncio faltante)
- Frontend: 0 testes unitários, apenas E2E com Playwright

**Impacto:** Qualquer refatoração é um tiro no escuro. Não existe rede de segurança para os changes recomendados neste documento.

**Ganho ao resolver:** Confiança para refatorar. CI que pega regressões.

---

### P2 — CI com Python 3.11 mas projeto requer 3.12+

**Evidência:** `.github/workflows/ci.yml` usa `python-version: "3.11"`. README diz "Python 3.12+".

**Impacto:** CI pode passar mas produção pode falhar (ou vice-versa) por features de 3.12 não disponíveis em 3.11.

**Ganho ao resolver:** Paridade CI/Prod. Confiança no pipeline.

---

### P2 — Fly.io: uma máquina, sem auto-scale real

**Evidência:** `fly.toml`:
```toml
min_machines_running = 1
memory = "512mb"
cpu_kind = "shared"
cpus = 1
```

**Impacto:**
- 512MB para FastAPI + frontend estático + uploads + alembic migration
- 1 CPU compartilhado
- Se o upload síncrono trava o worker, todas as requests travam
- Sem worker Celery (discutido acima)

**Ganho ao resolver:** Adicionar auto_start_machines com 2 min_machines ou migrar para 1GB.

---

### P2 — Arquivos de teste e PDFs soltos na raiz

**Evidência:** Git status mostra:
```
?? Fatura_Cartao_Celebre_Elo_Nanquin_01814_23847_66484.pdf
?? backend/test_bradesco_ocr.py
?? backend/test_extraction_fixes.py
?? backend/test_pdf_extraction.py
?? bradesco.pdf
?? fatura-pan.pdf
?? itau_sem.pdf
```

**Impacto:** PDFs de faturas reais (com dados pessoais?) na raiz do projeto. Scripts de teste fora do diretório de testes.

**Ganho ao resolver:** Mover para `tests/fixtures/` ou `.gitignore`. Eliminar risco de commit acidental de dados pessoais.

---

### P3 — .env.example com senhas de exemplo fracas

**Evidência:** `.env.example`:
```
SECRET_KEY=your-secret-key-here-change-in-production
```

**Impacto:** Baixo (é example file), mas dev preguiçoso pode usar em prod.

**Ganho ao resolver:** Gerar chave aleatória no script de setup.

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Resolver Celery/Redis** — decidir: adicionar Redis no Fly ou migrar para APScheduler
2. **Notificar quando automação auto-desabilita**
3. **Mover startup migration** para Alembic ou background task
4. **Limpar PDFs da raiz** — .gitignore ou tests/fixtures/
5. **Corrigir CI** para Python 3.12

### Médio prazo (3-4 sprints)

6. **Deprecar upload síncrono** — tudo pelo endpoint async
7. **Substituir `datetime.utcnow()`** por `datetime.now(timezone.utc)`
8. **Escrever testes mínimos** — auth, transactions, document upload, analytics
9. **Considerar 2 machines** no Fly.io ou upgrade para 1GB

### Longo prazo

10. **Suite de testes** com >50% coverage em modules core
11. **Observabilidade** — structured logging, APM, error tracking (Sentry)
