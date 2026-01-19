# Backlog #3: Orçamento por Envelopes

## Status: 📋 Planejado

## Descrição

Sistema de envelope budgeting (YNAB-style) com limites diários/semanais por categoria, permitindo controle mais granular que o orçamento mensal tradicional.

## Infraestrutura Atual

| Componente | Status | Localização |
|------------|--------|-------------|
| Budget Model | Apenas mensal | `models/budget.py` |
| BudgetItem | Por categoria | `models/budget.py` |
| is_fixed flag | Existe | `models/transaction.py` |
| Category Model | Completo | `models/category.py` |

## Conceito

Envelope budgeting é uma metodologia onde você "aloca" dinheiro em "envelopes" virtuais no início do período. Quando gasta, o dinheiro sai do envelope correspondente. Quando o envelope esvazia, você para de gastar naquela categoria ou transfere de outro envelope.

**Diferenças do orçamento tradicional:**
- Períodos flexíveis (diário, semanal, quinzenal, mensal)
- Rollover opcional (sobra vai para próximo período)
- Allowance diário calculado automaticamente
- Transferência entre envelopes

## Especificação Técnica

### Novas Tabelas

#### 1. spending_envelopes

```python
class SpendingEnvelope(Base):
    __tablename__ = "spending_envelopes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))

    # Identificação
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))

    # Período
    period_type: Mapped[str] = mapped_column(String(20))
    # daily/weekly/biweekly/monthly

    # Limite
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Saldo atual
    current_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    period_start_date: Mapped[date]
    period_end_date: Mapped[date]

    # Rollover
    allow_rollover: Mapped[bool] = mapped_column(default=False)
    max_rollover_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    rollover_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Refill automático
    refill_schedule: Mapped[str] = mapped_column(String(30), default="period_start")
    # period_start/weekly_monday/monthly_1st/monthly_15th/custom
    custom_refill_day: Mapped[int | None]  # 1-31 para custom
    auto_refill: Mapped[bool] = mapped_column(default=True)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="available")
    # available/depleted/overspent

    # UI
    priority: Mapped[int] = mapped_column(default=0)  # Para ordenação
    color: Mapped[str | None] = mapped_column(String(20))
    icon: Mapped[str | None] = mapped_column(String(50))

    # Controle
    is_active: Mapped[bool] = mapped_column(default=True)
    ownership_type: Mapped[str] = mapped_column(String(20), default="personal")
    # personal/shared

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="envelopes")
    category: Mapped["Category"] = relationship()
    history: Mapped[list["EnvelopeHistory"]] = relationship(back_populates="envelope")

    __table_args__ = (
        Index('ix_envelopes_user_active', 'user_id', 'is_active'),
        UniqueConstraint('user_id', 'category_id', name='uq_envelope_user_category'),
    )
```

#### 2. envelope_history

```python
class EnvelopeHistory(Base):
    __tablename__ = "envelope_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    envelope_id: Mapped[int] = mapped_column(ForeignKey("spending_envelopes.id", ondelete="CASCADE"))
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="SET NULL"))

    # Tipo de mudança
    change_type: Mapped[str] = mapped_column(String(30))
    # refill/spend/refund/rollover/adjustment/transfer_in/transfer_out

    # Valores
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    balance_before: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Contexto do período
    period_start: Mapped[date]
    period_end: Mapped[date]

    # Metadados
    notes: Mapped[str | None] = mapped_column(String(500))
    related_envelope_id: Mapped[int | None]  # Para transferências

    created_at: Mapped[datetime] = mapped_column(default=func.now())

    # Relationships
    envelope: Mapped["SpendingEnvelope"] = relationship(back_populates="history")
    transaction: Mapped["Transaction"] = relationship()

    __table_args__ = (
        Index('ix_envelope_history_envelope_date', 'envelope_id', 'created_at'),
    )
```

#### 3. Modificação em Transaction

```python
# Adicionar em Transaction model
envelope_id: Mapped[int | None] = mapped_column(
    ForeignKey("spending_envelopes.id", ondelete="SET NULL"),
    index=True
)

# Relationship
envelope: Mapped["SpendingEnvelope"] = relationship()
```

### Estrutura do Módulo

```
backend/app/modules/envelopes/
├── __init__.py
├── models/
│   ├── __init__.py
│   ├── envelope.py
│   └── history.py
├── schemas/
│   ├── __init__.py
│   └── envelope.py
├── routers/
│   ├── __init__.py
│   └── envelopes.py
└── services/
    ├── __init__.py
    └── envelope_service.py
```

### Schemas

```python
# schemas/envelope.py

class EnvelopeCreate(BaseModel):
    category_id: int
    name: str
    period_type: str  # daily/weekly/biweekly/monthly
    limit_amount: Decimal
    allow_rollover: bool = False
    max_rollover_amount: Decimal | None = None
    auto_refill: bool = True
    color: str | None = None
    icon: str | None = None

class EnvelopeUpdate(BaseModel):
    name: str | None = None
    limit_amount: Decimal | None = None
    allow_rollover: bool | None = None
    max_rollover_amount: Decimal | None = None
    auto_refill: bool | None = None
    is_active: bool | None = None
    color: str | None = None
    icon: str | None = None

class DailyAllowance(BaseModel):
    envelope_id: int
    envelope_name: str
    period_type: str

    # Valores
    limit_amount: Decimal
    current_balance: Decimal
    spent_this_period: Decimal

    # Dias
    days_remaining: int
    days_in_period: int

    # Allowance
    daily_allowance: Decimal  # balance / days_remaining
    suggested_daily: Decimal  # limit / days_in_period (ideal)

    # Status
    on_track: bool  # daily_allowance >= suggested_daily
    status: str  # available/tight/depleted/overspent
    percentage_used: float

class EnvelopeResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    name: str
    period_type: str

    limit_amount: Decimal
    current_balance: Decimal
    rollover_balance: Decimal

    period_start_date: date
    period_end_date: date

    status: str
    percentage_used: float

    daily_allowance: DailyAllowance

    allow_rollover: bool
    max_rollover_amount: Decimal | None
    auto_refill: bool

    color: str | None
    icon: str | None
    is_active: bool

class EnvelopeSummary(BaseModel):
    total_budgeted: Decimal
    total_available: Decimal
    total_spent: Decimal

    envelopes_on_track: int
    envelopes_tight: int
    envelopes_depleted: int
    envelopes_overspent: int

    envelopes: list[EnvelopeResponse]

class EnvelopeTransfer(BaseModel):
    from_envelope_id: int
    to_envelope_id: int
    amount: Decimal
    notes: str | None = None

class EnvelopeHistoryResponse(BaseModel):
    id: int
    change_type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    period_start: date
    period_end: date
    notes: str | None
    transaction_description: str | None
    created_at: datetime
```

### Serviço Principal

```python
class EnvelopeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # CRUD
    async def create_envelope(
        self,
        user: User,
        data: EnvelopeCreate
    ) -> SpendingEnvelope:
        """
        Cria envelope com período inicial calculado.
        """
        pass

    async def get_envelope(
        self,
        user: User,
        envelope_id: int
    ) -> EnvelopeResponse:
        """
        Retorna envelope com daily allowance calculado.
        """
        pass

    async def list_envelopes(
        self,
        user: User,
        include_inactive: bool = False
    ) -> list[EnvelopeResponse]:
        """
        Lista todos os envelopes do usuário.
        """
        pass

    async def get_summary(
        self,
        user: User
    ) -> EnvelopeSummary:
        """
        Resumo de todos os envelopes.
        """
        pass

    async def update_envelope(
        self,
        user: User,
        envelope_id: int,
        data: EnvelopeUpdate
    ) -> SpendingEnvelope:
        pass

    async def delete_envelope(
        self,
        user: User,
        envelope_id: int
    ) -> None:
        pass

    # Operações de saldo
    async def spend_from_envelope(
        self,
        envelope: SpendingEnvelope,
        transaction: Transaction,
        amount: Decimal
    ) -> EnvelopeHistory:
        """
        Deduz valor do envelope ao registrar despesa.
        Atualiza status (depleted/overspent).
        """
        pass

    async def refund_to_envelope(
        self,
        envelope: SpendingEnvelope,
        transaction: Transaction,
        amount: Decimal
    ) -> EnvelopeHistory:
        """
        Devolve valor ao envelope (estorno, edição).
        """
        pass

    async def refill_envelope(
        self,
        envelope: SpendingEnvelope,
        process_rollover: bool = True
    ) -> Decimal:
        """
        Reabastece envelope no início do período.
        Processa rollover se habilitado.
        Retorna novo saldo.
        """
        pass

    async def transfer_between_envelopes(
        self,
        user: User,
        transfer: EnvelopeTransfer
    ) -> tuple[EnvelopeHistory, EnvelopeHistory]:
        """
        Transfere valor entre envelopes.
        Retorna histórico de ambos.
        """
        pass

    # Cálculos
    async def calculate_daily_allowance(
        self,
        envelope: SpendingEnvelope
    ) -> DailyAllowance:
        """
        Calcula quanto pode gastar por dia.
        daily_allowance = current_balance / days_remaining
        """
        pass

    async def find_by_category(
        self,
        user: User,
        category_id: int
    ) -> SpendingEnvelope | None:
        """
        Encontra envelope pela categoria.
        """
        pass

    # Background tasks
    async def process_pending_refills(self) -> int:
        """
        Processa refills pendentes de todos os usuários.
        Chamado por Celery task.
        Retorna número de envelopes reabastecidos.
        """
        pass

    async def auto_assign_transaction(
        self,
        user: User,
        transaction: Transaction
    ) -> SpendingEnvelope | None:
        """
        Associa transação ao envelope baseado na categoria.
        """
        pass

    # Histórico
    async def get_history(
        self,
        user: User,
        envelope_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> list[EnvelopeHistoryResponse]:
        pass

    # Helpers
    def _calculate_period_dates(
        self,
        period_type: str,
        reference_date: date | None = None
    ) -> tuple[date, date]:
        """
        Calcula início e fim do período.
        """
        pass

    def _determine_status(
        self,
        current_balance: Decimal,
        limit_amount: Decimal
    ) -> str:
        """
        Determina status: available/depleted/overspent
        """
        if current_balance <= 0:
            return "depleted" if current_balance == 0 else "overspent"
        elif current_balance < limit_amount * Decimal("0.2"):
            return "tight"
        return "available"
```

### API Endpoints

```python
# routers/envelopes.py

@router.post("/")
async def create_envelope(
    data: EnvelopeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> EnvelopeResponse:
    """Cria novo envelope."""
    pass

@router.get("/")
async def list_envelopes(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[EnvelopeResponse]:
    """Lista envelopes."""
    pass

@router.get("/summary")
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> EnvelopeSummary:
    """Resumo de todos os envelopes."""
    pass

@router.get("/{envelope_id}")
async def get_envelope(
    envelope_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> EnvelopeResponse:
    """Detalhes do envelope."""
    pass

@router.patch("/{envelope_id}")
async def update_envelope(
    envelope_id: int,
    data: EnvelopeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> EnvelopeResponse:
    """Atualiza envelope."""
    pass

@router.delete("/{envelope_id}")
async def delete_envelope(
    envelope_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Remove envelope."""
    pass

@router.get("/{envelope_id}/daily-allowance")
async def get_daily_allowance(
    envelope_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DailyAllowance:
    """Calcula allowance diário."""
    pass

@router.get("/{envelope_id}/history")
async def get_history(
    envelope_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[EnvelopeHistoryResponse]:
    """Histórico do envelope."""
    pass

@router.post("/{envelope_id}/refill")
async def refill_envelope(
    envelope_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> EnvelopeResponse:
    """Força refill manual."""
    pass

@router.post("/transfer")
async def transfer_between_envelopes(
    transfer: EnvelopeTransfer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Transfere entre envelopes."""
    pass

@router.post("/auto-assign")
async def auto_assign_transactions(
    transaction_ids: list[int] | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Associa transações a envelopes automaticamente."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   └── Envelopes.tsx
└── components/envelopes/
    ├── EnvelopeCard.tsx          # Card individual
    ├── EnvelopeGrid.tsx          # Grid de cards
    ├── EnvelopeProgress.tsx      # Barra de progresso
    ├── DailyAllowanceWidget.tsx  # Widget de allowance
    ├── EnvelopeModal.tsx         # Modal criar/editar
    ├── TransferModal.tsx         # Modal de transferência
    ├── EnvelopeHistory.tsx       # Lista de histórico
    └── EnvelopeSummaryCard.tsx   # Card de resumo
```

### Integração com Transaction Service

```python
# Em transaction_service.py

async def create_transaction(self, user: User, data: TransactionCreate) -> Transaction:
    # ... código existente ...

    # Após criar a transação, se for despesa:
    if transaction.type == "expense" and transaction.category_id:
        envelope_service = EnvelopeService(self.db)
        envelope = await envelope_service.find_by_category(
            user, transaction.category_id
        )
        if envelope:
            await envelope_service.spend_from_envelope(
                envelope, transaction, transaction.amount
            )
            transaction.envelope_id = envelope.id
            await self.db.commit()

    return transaction

async def update_transaction(self, user: User, transaction_id: int, data: TransactionUpdate) -> Transaction:
    # Se o valor mudou, ajustar envelope
    if data.amount and data.amount != transaction.amount:
        if transaction.envelope_id:
            envelope_service = EnvelopeService(self.db)
            envelope = await envelope_service.get_by_id(transaction.envelope_id)

            # Estorna valor antigo
            await envelope_service.refund_to_envelope(
                envelope, transaction, transaction.amount
            )
            # Debita novo valor
            await envelope_service.spend_from_envelope(
                envelope, transaction, data.amount
            )

    # ... resto do update ...

async def delete_transaction(self, user: User, transaction_id: int) -> None:
    # Estorna do envelope se existir
    if transaction.envelope_id:
        envelope_service = EnvelopeService(self.db)
        envelope = await envelope_service.get_by_id(transaction.envelope_id)
        await envelope_service.refund_to_envelope(
            envelope, transaction, transaction.amount
        )

    # ... resto do delete ...
```

## Fases de Implementação

### Fase 1 (Semana 1): Database
- [ ] Migration para spending_envelopes
- [ ] Migration para envelope_history
- [ ] Alterar transaction (adicionar envelope_id)
- [ ] Models

### Fase 2 (Semana 2): Service CRUD
- [ ] EnvelopeService básico
- [ ] create/get/list/update/delete
- [ ] calculate_daily_allowance

### Fase 3 (Semana 3): Spending Integration
- [ ] spend_from_envelope
- [ ] refund_to_envelope
- [ ] Integrar com transaction_service

### Fase 4 (Semana 4): Advanced Features
- [ ] refill_envelope (com rollover)
- [ ] transfer_between_envelopes
- [ ] auto_assign_transaction

### Fase 5 (Semana 5): API
- [ ] Todos os endpoints
- [ ] Validações

### Fase 6 (Semana 6): Frontend
- [ ] EnvelopeCard component
- [ ] EnvelopeGrid
- [ ] Envelopes page

### Fase 7 (Semana 7): Frontend Extras
- [ ] EnvelopeModal
- [ ] TransferModal
- [ ] DailyAllowanceWidget
- [ ] Integrar no QuickTransactionModal

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `models/transaction.py` | Adicionar envelope_id |
| `transaction_service.py` | Integrar spend/refund |
| `QuickTransactionModal.tsx` | Mostrar envelope da categoria |
| `Layout.tsx` | Adicionar menu "Envelopes" |

## Critérios de Aceitação

1. [ ] Criar envelope semanal de R$500 para "Alimentação"
2. [ ] Ver daily allowance = saldo / dias restantes
3. [ ] Registrar despesa e ver dedução automática
4. [ ] Status muda para "depleted" quando saldo zera
5. [ ] Refill automático no início do período
6. [ ] Rollover funcionando (sobra vai para próximo período)
7. [ ] Transferir entre envelopes
8. [ ] Histórico mostra todas as movimentações
