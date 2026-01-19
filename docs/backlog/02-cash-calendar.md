# Backlog #2: Calendário de Caixa

## Status: 📋 Planejado

## Descrição

Visualização diária/semanal do fluxo de caixa combinando transações confirmadas com projeções futuras (recorrências, faturas, dívidas, rendas).

## Infraestrutura Atual

| Componente | Status | Localização |
|------------|--------|-------------|
| Transaction Model | ✅ Completo | `models/transaction.py:62` (índice em date) |
| Recurring Service | 80% | `recurring_service.py:365-416` (só gera até hoje) |
| Analytics | 50% | `analytics_service.py:37-153` (apenas mensal) |
| Frontend | 0% | Sem componente de calendário |

## Especificação Técnica

### Nova Tabela (Cache de Projeções)

```python
class CashCalendarProjection(Base):
    __tablename__ = "cash_calendar_projections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    projection_date: Mapped[date]
    projection_type: Mapped[str] = mapped_column(String(30))
    # Tipos: recurring/invoice/debt/income/installment

    # Referências (apenas uma será preenchida)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    recurring_id: Mapped[int | None] = mapped_column(ForeignKey("recurring_transactions.id", ondelete="CASCADE"))
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("credit_card_invoices.id", ondelete="CASCADE"))
    debt_id: Mapped[int | None] = mapped_column(ForeignKey("debts.id", ondelete="CASCADE"))
    income_source_id: Mapped[int | None] = mapped_column(ForeignKey("income_sources.id", ondelete="CASCADE"))

    # Dados da projeção
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    is_income: Mapped[bool]
    description: Mapped[str] = mapped_column(String(200))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))

    # Confiança (para renda variável)
    confidence: Mapped[float] = mapped_column(default=1.0)  # 0.0-1.0

    # Cache control
    generated_at: Mapped[datetime] = mapped_column(default=func.now())
    valid_until: Mapped[datetime]

    __table_args__ = (
        Index('ix_projections_user_date', 'user_id', 'projection_date'),
    )
```

### Estrutura do Módulo

```
backend/app/modules/calendar/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── projection.py
├── schemas/
│   ├── __init__.py
│   └── cash_calendar.py
├── routers/
│   ├── __init__.py
│   └── cash_calendar.py
└── services/
    ├── __init__.py
    └── cash_calendar_service.py
```

### Schemas

```python
# schemas/cash_calendar.py

class TransactionSummary(BaseModel):
    id: int
    description: str
    amount: Decimal
    type: str  # income/expense
    category_name: str | None
    account_name: str | None
    is_confirmed: bool = True

class ProjectionItem(BaseModel):
    id: int
    description: str
    amount: Decimal
    is_income: bool
    projection_type: str
    source_entity: str  # recurring/invoice/debt/income
    source_id: int
    confidence: float
    category_name: str | None
    account_name: str | None

class DailyEntry(BaseModel):
    date: date
    is_past: bool
    is_today: bool
    is_weekend: bool

    # Valores confirmados
    confirmed_income: Decimal = Decimal(0)
    confirmed_expense: Decimal = Decimal(0)
    confirmed_net: Decimal = Decimal(0)

    # Valores projetados
    projected_income: Decimal = Decimal(0)
    projected_expense: Decimal = Decimal(0)
    projected_net: Decimal = Decimal(0)

    # Total do dia
    total_income: Decimal = Decimal(0)
    total_expense: Decimal = Decimal(0)
    total_net: Decimal = Decimal(0)

    # Detalhes
    transactions: list[TransactionSummary] = []
    projections: list[ProjectionItem] = []

    # Indicadores
    has_major_expense: bool = False  # > 10% da renda mensal
    has_invoice_due: bool = False

class RunningBalanceEntry(BaseModel):
    date: date
    opening_balance: Decimal
    income: Decimal
    expense: Decimal
    net: Decimal
    closing_balance: Decimal
    is_projected: bool
    is_negative: bool = False

class WeeklySummary(BaseModel):
    year: int
    week: int
    start_date: date
    end_date: date

    total_income: Decimal
    total_expense: Decimal
    net: Decimal

    # Comparação com semana anterior
    previous_week_net: Decimal | None
    change_percentage: float | None

    # Top categorias
    top_expense_categories: list[dict]

    daily_breakdown: list[DailyEntry]

class MajorExpense(BaseModel):
    date: date
    description: str
    amount: Decimal
    source: str
    days_until: int

class CashCalendarResponse(BaseModel):
    start_date: date
    end_date: date

    # Saldos
    current_balance: Decimal
    projected_end_balance: Decimal
    lowest_balance: Decimal
    lowest_balance_date: date | None

    # Alertas
    shortfall_dates: list[date]  # Dias com saldo negativo projetado
    major_expenses: list[MajorExpense]

    # Dados
    daily_entries: list[DailyEntry]
    running_balance: list[RunningBalanceEntry]

    # Totais do período
    total_confirmed_income: Decimal
    total_confirmed_expense: Decimal
    total_projected_income: Decimal
    total_projected_expense: Decimal
```

### Serviço Principal

```python
class CashCalendarService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_daily_entries(
        self,
        user: User,
        start_date: date,
        end_date: date,
        include_projections: bool = True,
        account_ids: list[int] | None = None
    ) -> list[DailyEntry]:
        """
        Combina transações confirmadas com projeções futuras.

        Para cada dia no range:
        1. Busca transações confirmadas
        2. Se include_projections e dia > hoje: adiciona projeções
        3. Calcula totais
        """
        pass

    async def get_running_balance(
        self,
        user: User,
        start_date: date,
        end_date: date,
        starting_balance: Decimal | None = None,
        account_ids: list[int] | None = None
    ) -> list[RunningBalanceEntry]:
        """
        Calcula saldo corrente dia a dia.

        Se starting_balance não fornecido:
        - Usa soma de saldos das contas selecionadas
        """
        pass

    async def get_weekly_summary(
        self,
        user: User,
        year: int,
        week: int,
        compare_with_previous: bool = True
    ) -> WeeklySummary:
        """
        Resumo semanal com comparação opcional com semana anterior.
        """
        pass

    async def get_monthly_view(
        self,
        user: User,
        year: int,
        month: int
    ) -> CashCalendarResponse:
        """
        Visualização mensal completa com projeções.
        """
        pass

    async def project_future(
        self,
        user: User,
        days_ahead: int = 90
    ) -> CashCalendarResponse:
        """
        Projeção de N dias com detecção de shortfall.

        Fontes de projeção:
        1. Recurring transactions
        2. Credit card invoices
        3. Debt payments
        4. Income sources
        5. Installments
        """
        pass

    async def refresh_projections(
        self,
        user: User,
        days_ahead: int = 90
    ) -> int:
        """
        Regenera cache de projeções.
        Retorna número de projeções geradas.
        """
        pass

    async def _generate_recurring_projections(
        self,
        user: User,
        start_date: date,
        end_date: date
    ) -> list[CashCalendarProjection]:
        """
        Gera projeções baseadas em recorrências ativas.
        Estende recurring_service._calculate_next_due_date().
        """
        pass

    async def _generate_invoice_projections(
        self,
        user: User,
        start_date: date,
        end_date: date
    ) -> list[CashCalendarProjection]:
        """
        Gera projeções baseadas em faturas de cartão.
        """
        pass

    async def _generate_debt_projections(
        self,
        user: User,
        start_date: date,
        end_date: date
    ) -> list[CashCalendarProjection]:
        """
        Gera projeções baseadas em pagamentos de dívidas.
        """
        pass

    async def _generate_income_projections(
        self,
        user: User,
        start_date: date,
        end_date: date
    ) -> list[CashCalendarProjection]:
        """
        Gera projeções baseadas em fontes de renda.
        """
        pass

    async def _detect_shortfalls(
        self,
        running_balance: list[RunningBalanceEntry]
    ) -> list[date]:
        """
        Detecta datas com saldo negativo projetado.
        """
        pass

    async def _find_major_expenses(
        self,
        user: User,
        entries: list[DailyEntry],
        threshold_percentage: float = 0.1
    ) -> list[MajorExpense]:
        """
        Encontra despesas significativas (> 10% renda mensal).
        """
        pass
```

### API Endpoints

```python
# routers/cash_calendar.py

@router.get("/daily")
async def get_daily_entries(
    start_date: date,
    end_date: date,
    include_projections: bool = True,
    account_ids: list[int] | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[DailyEntry]:
    """Lista entradas diárias no período."""
    pass

@router.get("/weekly/{year}/{week}")
async def get_weekly_summary(
    year: int,
    week: int,
    compare_previous: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> WeeklySummary:
    """Resumo da semana."""
    pass

@router.get("/monthly/{year}/{month}")
async def get_monthly_view(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CashCalendarResponse:
    """Visualização mensal."""
    pass

@router.get("/running-balance")
async def get_running_balance(
    start_date: date,
    end_date: date,
    starting_balance: Decimal | None = None,
    account_ids: list[int] | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[RunningBalanceEntry]:
    """Saldo corrente dia a dia."""
    pass

@router.get("/projections/{days_ahead}")
async def get_projections(
    days_ahead: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CashCalendarResponse:
    """Projeção de fluxo de caixa."""
    pass

@router.post("/refresh-projections")
async def refresh_projections(
    days_ahead: int = 90,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Força regeneração do cache de projeções."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   └── CashCalendar.tsx
└── components/calendar/
    ├── CashCalendar.tsx          # Container principal
    ├── CalendarHeader.tsx        # Navegação mês/semana
    ├── CalendarGrid.tsx          # Grid de dias
    ├── DayCell.tsx               # Célula individual
    ├── WeekRow.tsx               # Linha da semana (opcional)
    ├── DayDetailModal.tsx        # Modal ao clicar no dia
    ├── RunningBalanceChart.tsx   # Gráfico de saldo
    ├── ShortfallAlert.tsx        # Alerta de saldo negativo
    └── ProjectionLegend.tsx      # Legenda cores/tipos
```

### Extensão do Recurring Service

```python
# recurring_service.py - adicionar método

async def project_future_occurrences(
    self,
    user: User,
    recurring_id: int | None = None,
    days_ahead: int = 90
) -> list[dict]:
    """
    Projeta ocorrências futuras de transações recorrentes.

    Args:
        user: Usuário
        recurring_id: Se None, projeta todas as recorrências ativas
        days_ahead: Dias para projetar

    Returns:
        Lista de projeções com date, amount, description, category_id, etc.
    """
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    # Query recorrências ativas
    if recurring_id:
        recurrings = [await self.get_by_id(user, recurring_id)]
    else:
        recurrings = await self.list_active(user)

    projections = []
    for recurring in recurrings:
        # Calcular próximas datas
        next_date = self._calculate_next_due_date(
            recurring.start_date,
            recurring.frequency,
            recurring.interval,
            recurring.day_of_month,
            recurring.day_of_week,
            today
        )

        while next_date <= end_date:
            projections.append({
                "recurring_id": recurring.id,
                "date": next_date,
                "amount": recurring.amount,
                "description": recurring.description,
                "is_income": recurring.type == "income",
                "category_id": recurring.category_id,
                "account_id": recurring.account_id,
            })

            # Próxima ocorrência
            next_date = self._calculate_next_due_date(
                recurring.start_date,
                recurring.frequency,
                recurring.interval,
                recurring.day_of_month,
                recurring.day_of_week,
                next_date + timedelta(days=1)
            )

    return sorted(projections, key=lambda x: x["date"])
```

## Fases de Implementação

### Fase 1 (Semana 1): Database
- [ ] Migration para cash_calendar_projections
- [ ] Model CashCalendarProjection
- [ ] Schemas básicos

### Fase 2 (Semana 2): Service
- [ ] CashCalendarService.get_daily_entries()
- [ ] CashCalendarService.get_running_balance()
- [ ] Integração com transaction queries

### Fase 3 (Semana 3): Projections
- [ ] Estender recurring_service
- [ ] _generate_recurring_projections()
- [ ] _generate_invoice_projections()
- [ ] _generate_debt_projections()
- [ ] _generate_income_projections()

### Fase 4 (Semana 4): API
- [ ] Todos os endpoints
- [ ] Paginação
- [ ] Filtros por conta

### Fase 5 (Semana 5): Frontend Calendar
- [ ] CashCalendar page
- [ ] CalendarGrid component
- [ ] DayCell component
- [ ] Navegação mês/semana

### Fase 6 (Semana 6): Frontend Extras
- [ ] RunningBalanceChart
- [ ] DayDetailModal
- [ ] ShortfallAlert
- [ ] Testes

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `recurring_service.py` | Adicionar `project_future_occurrences()` |
| `Layout.tsx` | Adicionar link "Calendário" no menu |
| `routers/__init__.py` | Incluir calendar router |

## Critérios de Aceitação

1. [ ] Visualizar calendário mensal com transações confirmadas
2. [ ] Ver projeções futuras de recorrências
3. [ ] Ver faturas de cartão no calendário
4. [ ] Gráfico de saldo corrente
5. [ ] Alerta quando saldo projetado for negativo
6. [ ] Detalhe do dia em modal
7. [ ] Navegação entre meses funcional
