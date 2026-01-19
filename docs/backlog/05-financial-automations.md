# Backlog #5: Automações Financeiras

## Status: 📋 Planejado

## Descrição

Sistema de regras condicionais para automatizar ações financeiras como transferências, categorizações automáticas e notificações.

## Dependência

**Requer Backlog #1** (Sistema de Alertas) para infraestrutura Celery/Redis.

## Especificação Técnica

### Nova Tabela

```python
class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Identificação
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))

    # Trigger (quando executar)
    trigger_type: Mapped[str] = mapped_column(String(30))
    # schedule/event/threshold
    trigger_config: Mapped[dict] = mapped_column(JSONB)

    # Conditions (condições adicionais)
    conditions: Mapped[dict] = mapped_column(JSONB, default=[])

    # Action (o que fazer)
    action_type: Mapped[str] = mapped_column(String(30))
    # transfer/categorize/notify/generate_transaction
    action_config: Mapped[dict] = mapped_column(JSONB)

    # Status
    is_active: Mapped[bool] = mapped_column(default=True)
    last_executed: Mapped[datetime | None]
    last_execution_result: Mapped[str | None] = mapped_column(String(50))
    # success/failed/skipped
    execution_count: Mapped[int] = mapped_column(default=0)

    # Limites
    max_executions_per_day: Mapped[int | None]
    max_executions_total: Mapped[int | None]

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_automation_rules_user_active', 'user_id', 'is_active'),
    )

class AutomationExecutionLog(Base):
    __tablename__ = "automation_execution_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("automation_rules.id", ondelete="CASCADE"))

    executed_at: Mapped[datetime] = mapped_column(default=func.now())
    trigger_data: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[str] = mapped_column(String(50))  # success/failed/skipped
    result_data: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
```

### Tipos de Trigger

#### 1. Schedule (Agendamento)

```python
# Exemplos de trigger_config para schedule:

# Dia específico do mês
{
    "type": "monthly",
    "day_of_month": 5,
    "time": "08:00"
}

# Dia da semana
{
    "type": "weekly",
    "day_of_week": "monday",
    "time": "09:00"
}

# Diário
{
    "type": "daily",
    "time": "20:00"
}
```

#### 2. Event (Evento)

```python
# Exemplos de trigger_config para event:

# Transação criada
{
    "event": "transaction_created",
    "filters": {
        "type": "expense",
        "category_id": 5,
        "amount_min": 100
    }
}

# Fatura fechada
{
    "event": "invoice_closed",
    "filters": {
        "card_id": 1
    }
}

# Meta atingida
{
    "event": "goal_achieved",
    "filters": {}
}

# Saldo alterado
{
    "event": "balance_changed",
    "filters": {
        "account_id": 1
    }
}
```

#### 3. Threshold (Limite)

```python
# Exemplos de trigger_config para threshold:

# Saldo abaixo de X
{
    "metric": "account_balance",
    "account_id": 1,
    "operator": "below",
    "value": 500
}

# Categoria acima de Y% do orçamento
{
    "metric": "category_budget_percentage",
    "category_id": 5,
    "operator": "above",
    "value": 80
}

# Sobra do mês acima de Z
{
    "metric": "monthly_surplus",
    "operator": "above",
    "value": 1000
}
```

### Tipos de Action

#### 1. Transfer (Transferência)

```python
{
    "type": "transfer",
    "from_account_id": 1,
    "to_account_id": 2,
    "amount_type": "fixed",  # fixed/percentage/remaining
    "amount_value": 500,
    "description": "Transferência automática para reserva"
}

# Transferir porcentagem da renda
{
    "type": "transfer",
    "from_account_id": 1,
    "to_account_id": 2,
    "amount_type": "percentage",
    "amount_value": 20,  # 20% da renda
    "reference": "monthly_income"
}

# Transferir o que sobrar
{
    "type": "transfer",
    "from_account_id": 1,
    "to_account_id": 2,
    "amount_type": "remaining",
    "keep_minimum": 200  # Manter pelo menos R$200
}
```

#### 2. Categorize (Categorização)

```python
{
    "type": "categorize",
    "category_id": 5,
    "match_description": ["uber", "99", "taxi"],
    "case_insensitive": true
}
```

#### 3. Notify (Notificação)

```python
{
    "type": "notify",
    "title": "Saldo baixo!",
    "message": "Sua conta principal está com saldo baixo.",
    "priority": "high",
    "channels": ["in_app", "push"]
}
```

#### 4. Generate Transaction (Gerar Transação)

```python
{
    "type": "generate_transaction",
    "transaction": {
        "type": "expense",
        "amount": 100,
        "description": "Reserva automática",
        "category_id": 10,
        "account_id": 1
    }
}
```

### Conditions (Condições Adicionais)

```python
# Array de condições que devem ser verdadeiras
[
    {
        "type": "balance_above",
        "account_id": 1,
        "value": 500
    },
    {
        "type": "day_range",
        "start_day": 1,
        "end_day": 10
    },
    {
        "type": "has_income_this_month",
        "value": true
    }
]
```

### Estrutura do Módulo

```
backend/app/modules/automations/
├── __init__.py
├── models/
│   ├── __init__.py
│   ├── rule.py
│   └── execution_log.py
├── schemas/
│   ├── __init__.py
│   └── automation.py
├── routers/
│   ├── __init__.py
│   └── automations.py
├── services/
│   ├── __init__.py
│   ├── automation_service.py
│   └── rule_engine.py
└── tasks/
    ├── __init__.py
    └── automation_tasks.py
```

### Serviço Principal

```python
class AutomationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rule_engine = RuleEngine(db)

    # CRUD
    async def create_rule(self, user: User, data: RuleCreate) -> AutomationRule:
        pass

    async def list_rules(self, user: User, is_active: bool | None = None) -> list[AutomationRule]:
        pass

    async def get_rule(self, user: User, rule_id: int) -> AutomationRule:
        pass

    async def update_rule(self, user: User, rule_id: int, data: RuleUpdate) -> AutomationRule:
        pass

    async def delete_rule(self, user: User, rule_id: int) -> None:
        pass

    async def toggle_rule(self, user: User, rule_id: int) -> AutomationRule:
        pass

    # Execução
    async def execute_rule(self, rule: AutomationRule, trigger_data: dict | None = None) -> dict:
        """Executa uma regra manualmente ou por trigger."""
        pass

    async def test_rule(self, user: User, rule_id: int) -> dict:
        """Testa regra sem executar ação real."""
        pass

    # Logs
    async def get_execution_logs(
        self,
        user: User,
        rule_id: int | None = None,
        limit: int = 50
    ) -> list[AutomationExecutionLog]:
        pass


class RuleEngine:
    """Motor de avaliação de regras."""

    async def evaluate_conditions(
        self,
        rule: AutomationRule,
        context: dict
    ) -> bool:
        """Avalia se todas as condições são verdadeiras."""
        pass

    async def execute_action(
        self,
        rule: AutomationRule,
        context: dict
    ) -> dict:
        """Executa a ação da regra."""
        pass

    async def process_scheduled_rules(self) -> int:
        """Processa regras agendadas. Chamado por Celery."""
        pass

    async def process_event_rules(
        self,
        event_type: str,
        event_data: dict,
        user_id: int
    ) -> int:
        """Processa regras baseadas em evento."""
        pass

    async def process_threshold_rules(self, user_id: int) -> int:
        """Processa regras baseadas em threshold."""
        pass
```

### API Endpoints

```python
@router.post("/rules")
async def create_rule(
    data: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> RuleResponse:
    pass

@router.get("/rules")
async def list_rules(
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[RuleResponse]:
    pass

@router.get("/rules/{rule_id}")
async def get_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> RuleResponse:
    pass

@router.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: int,
    data: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> RuleResponse:
    pass

@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    pass

@router.post("/rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> RuleResponse:
    pass

@router.post("/rules/{rule_id}/test")
async def test_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    pass

@router.post("/rules/{rule_id}/execute")
async def execute_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    pass

@router.get("/rules/{rule_id}/logs")
async def get_rule_logs(
    rule_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[ExecutionLogResponse]:
    pass

@router.get("/templates")
async def get_rule_templates(
    current_user: User = Depends(get_current_user)
) -> list[RuleTemplate]:
    """Retorna templates pré-definidos de regras comuns."""
    pass
```

### Celery Tasks

```python
# tasks/automation_tasks.py

@celery_app.task
def process_scheduled_automations():
    """Executado a cada minuto para verificar regras agendadas."""
    pass

@celery_app.task
def process_threshold_automations(user_id: int):
    """Executado quando métricas relevantes mudam."""
    pass

@celery_app.task
def execute_automation_rule(rule_id: int, trigger_data: dict = None):
    """Executa uma regra específica."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   └── Automations.tsx
└── components/automations/
    ├── AutomationCard.tsx        # Card de regra
    ├── AutomationList.tsx        # Lista de regras
    ├── RuleBuilder.tsx           # Builder visual
    ├── TriggerConfig.tsx         # Config de trigger
    ├── ConditionBuilder.tsx      # Builder de condições
    ├── ActionConfig.tsx          # Config de ação
    ├── TemplateSelector.tsx      # Seletor de templates
    └── ExecutionLogs.tsx         # Histórico de execuções
```

### Templates Pré-definidos

```python
RULE_TEMPLATES = [
    {
        "name": "Reserva automática no dia do salário",
        "description": "Transfere 20% da renda para reserva no dia 5",
        "trigger_type": "schedule",
        "trigger_config": {"type": "monthly", "day_of_month": 5},
        "action_type": "transfer",
        "action_config": {
            "amount_type": "percentage",
            "amount_value": 20,
            "reference": "monthly_income"
        }
    },
    {
        "name": "Investir sobra do mês",
        "description": "Transfere o que sobrar para investimentos no dia 25",
        "trigger_type": "schedule",
        "trigger_config": {"type": "monthly", "day_of_month": 25},
        "conditions": [{"type": "balance_above", "value": 500}],
        "action_type": "transfer",
        "action_config": {"amount_type": "remaining", "keep_minimum": 500}
    },
    {
        "name": "Alerta de gasto alto",
        "description": "Notifica quando transação > R$500",
        "trigger_type": "event",
        "trigger_config": {"event": "transaction_created", "filters": {"amount_min": 500}},
        "action_type": "notify",
        "action_config": {"title": "Gasto alto!", "priority": "high"}
    }
]
```

## Fases de Implementação

### Fase 1 (Semana 1): Database
- [ ] Migration para automation_rules
- [ ] Migration para automation_execution_logs
- [ ] Models

### Fase 2 (Semana 2): Rule Engine
- [ ] RuleEngine class
- [ ] evaluate_conditions()
- [ ] execute_action() para cada tipo

### Fase 3 (Semana 3): Triggers
- [ ] Celery tasks para schedule
- [ ] Event hooks em transaction_service
- [ ] Threshold checks

### Fase 4 (Semana 4): API
- [ ] Todos os endpoints
- [ ] Templates
- [ ] Logs

### Fase 5 (Semana 5): Frontend
- [ ] Automations page
- [ ] RuleBuilder
- [ ] TemplateSelector

### Fase 6 (Semana 6): Polish
- [ ] Testes
- [ ] Audit trail
- [ ] Error handling robusto

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `transaction_service.py` | Hook para event triggers |
| `celery_config.py` | Adicionar tasks de automação |
| `Layout.tsx` | Menu "Automações" |

## Critérios de Aceitação

1. [ ] Criar regra de transferência automática
2. [ ] Regra executa no dia correto
3. [ ] Condições são avaliadas corretamente
4. [ ] Histórico de execuções disponível
5. [ ] Templates funcionam
6. [ ] Teste de regra sem executar
