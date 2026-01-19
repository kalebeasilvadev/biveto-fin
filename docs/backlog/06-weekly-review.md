# Backlog #6: Revisão Semanal Guiada

## Status: 📋 Planejado

## Descrição

Fluxo guiado de 5-10 minutos para revisar finanças da semana, com checklist interativo e insights acionáveis.

## Dependência

**Beneficia-se do Backlog #2** (Calendário de Caixa) para projeções da próxima semana.

## Conceito

A revisão semanal é uma prática recomendada por especialistas em finanças pessoais (incluindo YNAB, Dave Ramsey, etc.) para manter o controle financeiro. O objetivo é:

1. **Reconciliar** transações da semana
2. **Categorizar** pendentes
3. **Analisar** gastos vs orçamento
4. **Planejar** a próxima semana
5. **Celebrar** progressos em metas

## Especificação Técnica

### Nova Tabela

```python
class WeeklyReviewCompletion(Base):
    __tablename__ = "weekly_review_completions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    year: Mapped[int]
    week: Mapped[int]  # ISO week number

    # Datas
    week_start: Mapped[date]
    week_end: Mapped[date]

    # Status
    started_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]
    completion_percentage: Mapped[int] = mapped_column(default=0)

    # Steps completados
    steps_completed: Mapped[dict] = mapped_column(JSONB, default={})
    # {
    #   "summary_viewed": true,
    #   "transactions_categorized": true,
    #   "budget_reviewed": true,
    #   "goals_checked": true,
    #   "next_week_previewed": true
    # }

    # Métricas da semana (snapshot)
    metrics: Mapped[dict] = mapped_column(JSONB)
    # {
    #   "total_income": 5000,
    #   "total_expense": 3500,
    #   "net": 1500,
    #   "transactions_count": 45,
    #   "uncategorized_count": 3,
    #   "budget_adherence": 0.85
    # }

    # Notas do usuário
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint('user_id', 'year', 'week'),
        Index('ix_weekly_review_user_date', 'user_id', 'year', 'week'),
    )
```

### Estrutura do Módulo

```
backend/app/modules/review/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── weekly_review.py
├── schemas/
│   ├── __init__.py
│   └── weekly_review.py
├── routers/
│   ├── __init__.py
│   └── weekly_review.py
└── services/
    ├── __init__.py
    └── weekly_review_service.py
```

### Schemas

```python
# schemas/weekly_review.py

class WeeklySummary(BaseModel):
    """Resumo da semana para o Step 1."""
    year: int
    week: int
    week_start: date
    week_end: date

    # Totais
    total_income: Decimal
    total_expense: Decimal
    net: Decimal

    # Contagens
    transactions_count: int
    income_transactions: int
    expense_transactions: int

    # Comparação com semana anterior
    previous_week_expense: Decimal | None
    expense_change_percentage: float | None

    # Destaques
    largest_expense: dict | None  # {description, amount, category}
    most_frequent_category: dict | None  # {name, count, total}

class UncategorizedTransaction(BaseModel):
    """Transação sem categoria para o Step 2."""
    id: int
    date: date
    description: str
    amount: Decimal
    type: str
    suggested_category_id: int | None
    suggested_category_name: str | None

class BudgetComparison(BaseModel):
    """Comparação orçado vs realizado para o Step 3."""
    category_id: int
    category_name: str
    budgeted: Decimal
    actual: Decimal
    difference: Decimal
    percentage_used: float
    status: str  # under/on_track/over

class BudgetReviewData(BaseModel):
    """Dados de orçamento para o Step 3."""
    total_budgeted: Decimal
    total_spent: Decimal
    overall_percentage: float
    overall_status: str
    categories: list[BudgetComparison]

    # Insights
    overspent_categories: list[str]
    underspent_categories: list[str]

class GoalProgress(BaseModel):
    """Progresso de meta para o Step 4."""
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    percentage: float

    # Progresso na semana
    week_contribution: Decimal
    projected_completion: date | None

    # Status
    on_track: bool
    suggested_action: str | None

class GoalsReviewData(BaseModel):
    """Dados de metas para o Step 4."""
    goals: list[GoalProgress]
    total_saved_this_week: Decimal
    goals_on_track: int
    goals_behind: int

class UpcomingEvent(BaseModel):
    """Evento da próxima semana para o Step 5."""
    date: date
    description: str
    amount: Decimal
    type: str  # income/expense/invoice/recurring
    source: str  # transaction/invoice/recurring/debt

class NextWeekPreview(BaseModel):
    """Prévia da próxima semana para o Step 5."""
    week_start: date
    week_end: date

    expected_income: Decimal
    expected_expense: Decimal
    expected_net: Decimal

    events: list[UpcomingEvent]

    # Alertas
    invoice_due: bool
    invoice_amount: Decimal | None
    low_balance_risk: bool
    low_balance_date: date | None

class WeeklyReviewStep(BaseModel):
    """Um step da revisão."""
    step_number: int
    step_id: str
    title: str
    description: str
    is_completed: bool
    data: dict  # Dados específicos do step

class WeeklyReviewResponse(BaseModel):
    """Resposta completa da revisão."""
    year: int
    week: int
    week_start: date
    week_end: date

    is_completed: bool
    completion_percentage: int
    started_at: datetime | None
    completed_at: datetime | None

    steps: list[WeeklyReviewStep]

    # Streak
    consecutive_weeks: int
    total_reviews: int
```

### Serviço Principal

```python
class WeeklyReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_review(
        self,
        user: User,
        year: int,
        week: int
    ) -> WeeklyReviewResponse:
        """
        Retorna a revisão semanal com todos os steps.
        Cria registro se não existir.
        """
        pass

    async def get_current_week_review(
        self,
        user: User
    ) -> WeeklyReviewResponse:
        """Atalho para a semana atual."""
        pass

    async def complete_step(
        self,
        user: User,
        year: int,
        week: int,
        step_id: str
    ) -> WeeklyReviewResponse:
        """Marca um step como concluído."""
        pass

    async def complete_review(
        self,
        user: User,
        year: int,
        week: int,
        notes: str | None = None
    ) -> WeeklyReviewResponse:
        """Finaliza a revisão semanal."""
        pass

    async def get_streak(
        self,
        user: User
    ) -> dict:
        """Retorna streak de revisões consecutivas."""
        pass

    # Data fetchers para cada step
    async def get_weekly_summary(
        self,
        user: User,
        year: int,
        week: int
    ) -> WeeklySummary:
        """Step 1: Resumo da semana."""
        pass

    async def get_uncategorized_transactions(
        self,
        user: User,
        year: int,
        week: int
    ) -> list[UncategorizedTransaction]:
        """Step 2: Transações não categorizadas."""
        pass

    async def get_budget_review(
        self,
        user: User,
        year: int,
        week: int
    ) -> BudgetReviewData:
        """Step 3: Orçado vs Realizado."""
        pass

    async def get_goals_review(
        self,
        user: User,
        year: int,
        week: int
    ) -> GoalsReviewData:
        """Step 4: Progresso das metas."""
        pass

    async def get_next_week_preview(
        self,
        user: User,
        year: int,
        week: int
    ) -> NextWeekPreview:
        """Step 5: Prévia da próxima semana."""
        pass

    async def suggest_category(
        self,
        user: User,
        transaction_id: int
    ) -> int | None:
        """Sugere categoria baseada em histórico."""
        pass
```

### API Endpoints

```python
@router.get("/current")
async def get_current_review(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> WeeklyReviewResponse:
    """Revisão da semana atual."""
    pass

@router.get("/{year}/{week}")
async def get_review(
    year: int,
    week: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> WeeklyReviewResponse:
    """Revisão de uma semana específica."""
    pass

@router.post("/{year}/{week}/steps/{step_id}/complete")
async def complete_step(
    year: int,
    week: int,
    step_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> WeeklyReviewResponse:
    """Marca step como concluído."""
    pass

@router.post("/{year}/{week}/complete")
async def complete_review(
    year: int,
    week: int,
    notes: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> WeeklyReviewResponse:
    """Finaliza revisão."""
    pass

@router.get("/streak")
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Streak de revisões."""
    pass

@router.get("/history")
async def get_review_history(
    limit: int = 12,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[WeeklyReviewResponse]:
    """Histórico de revisões."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   └── WeeklyReview.tsx
└── components/review/
    ├── ReviewWizard.tsx          # Container do wizard
    ├── ReviewProgress.tsx        # Barra de progresso
    ├── ReviewStep.tsx            # Step genérico
    ├── SummaryStep.tsx           # Step 1: Resumo
    ├── CategorizeStep.tsx        # Step 2: Categorizar
    ├── BudgetStep.tsx            # Step 3: Orçamento
    ├── GoalsStep.tsx             # Step 4: Metas
    ├── NextWeekStep.tsx          # Step 5: Próxima semana
    ├── CompletionStep.tsx        # Step final: Parabéns
    ├── ReviewStreak.tsx          # Widget de streak
    └── QuickCategorize.tsx       # Mini form para categorizar
```

### Exemplo de UI: Review Wizard

```tsx
// pages/WeeklyReview.tsx

export function WeeklyReview() {
  const [currentStep, setCurrentStep] = useState(0);
  const { data: review } = useWeeklyReview();

  const steps = [
    { id: 'summary', title: 'Resumo da Semana', component: SummaryStep },
    { id: 'categorize', title: 'Categorizar Transações', component: CategorizeStep },
    { id: 'budget', title: 'Orçamento', component: BudgetStep },
    { id: 'goals', title: 'Metas', component: GoalsStep },
    { id: 'next_week', title: 'Próxima Semana', component: NextWeekStep },
  ];

  const handleStepComplete = async () => {
    await completeStep(review.year, review.week, steps[currentStep].id);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Revisão Semanal</h1>
        <p className="text-gray-600">
          Semana {review.week} de {review.year}
        </p>
      </div>

      <ReviewProgress
        current={currentStep}
        total={steps.length}
        steps={steps.map(s => s.title)}
      />

      <div className="mt-6">
        {React.createElement(steps[currentStep].component, {
          review,
          onComplete: handleStepComplete
        })}
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep(currentStep - 1)}
        >
          Anterior
        </Button>

        <Button onClick={handleStepComplete}>
          {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
        </Button>
      </div>
    </div>
  );
}
```

### Exemplo: Summary Step

```tsx
// components/review/SummaryStep.tsx

export function SummaryStep({ review, onComplete }) {
  const summary = review.steps.find(s => s.step_id === 'summary')?.data;

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-4">
        Como foi sua semana?
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat
          label="Receitas"
          value={formatCurrency(summary.total_income)}
          color="green"
        />
        <Stat
          label="Despesas"
          value={formatCurrency(summary.total_expense)}
          color="red"
        />
        <Stat
          label="Saldo"
          value={formatCurrency(summary.net)}
          color={summary.net >= 0 ? 'green' : 'red'}
        />
      </div>

      {summary.expense_change_percentage && (
        <Alert>
          Você gastou {Math.abs(summary.expense_change_percentage)}%
          {summary.expense_change_percentage > 0 ? 'mais' : 'menos'}
          que na semana passada.
        </Alert>
      )}

      {summary.largest_expense && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Maior gasto:</p>
          <p className="font-medium">
            {summary.largest_expense.description} - {formatCurrency(summary.largest_expense.amount)}
          </p>
        </div>
      )}
    </Card>
  );
}
```

## Fases de Implementação

### Fase 1 (Semana 1): Database + Service
- [ ] Migration para weekly_review_completions
- [ ] Model
- [ ] WeeklyReviewService básico

### Fase 2 (Semana 2): Data Fetchers
- [ ] get_weekly_summary()
- [ ] get_uncategorized_transactions()
- [ ] get_budget_review()
- [ ] get_goals_review()
- [ ] get_next_week_preview()

### Fase 3 (Semana 3): API
- [ ] Todos os endpoints
- [ ] Streak calculation

### Fase 4 (Semana 4): Frontend
- [ ] ReviewWizard
- [ ] Todos os steps
- [ ] ReviewProgress

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `Layout.tsx` | Adicionar link "Revisão" no menu |
| `Dashboard.tsx` | Widget de "Fazer revisão semanal" |

## Critérios de Aceitação

1. [ ] Wizard de 5 steps funciona
2. [ ] Step de categorização permite categorizar inline
3. [ ] Comparação orçado vs realizado visual
4. [ ] Progresso de metas mostra contribuição da semana
5. [ ] Prévia da próxima semana funciona
6. [ ] Streak é calculado corretamente
7. [ ] Revisão pode ser retomada de onde parou
