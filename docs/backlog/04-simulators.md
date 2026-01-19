# Backlog #4: Simuladores "E Se..."

## Status: 📋 Planejado

## Descrição

Interface interativa para simulações financeiras, permitindo comparar cenários de pagamento de dívidas, contribuições para metas, e impacto de mudanças no orçamento.

## Infraestrutura Atual (JÁ EXISTE!)

O backend já possui lógica de simulação implementada:

| Componente | Status | Localização |
|------------|--------|-------------|
| Debt Snowball | ✅ | `debt_service.py:307-420` |
| Debt Avalanche | ✅ | `debt_service.py:421-500` |
| Compare Strategies | ✅ | `debt_service.py:501-579` |
| Goal Projection | ✅ | `goal_service.py:282-400` |
| Emergency Fund Calc | ✅ | `goal_service.py:401-450` |
| PNIF (Cerbasi) | ✅ | `goal_service.py:451-516` |
| Income Preview | ✅ | `income_transaction_service.py:243-287` |
| **Frontend UI** | ❌ | Não existe |
| **Cenários salvos** | ❌ | Não existe |

## O Que Falta Implementar

1. **Frontend interativo** com sliders e gráficos
2. **Persistência de cenários** para comparação futura
3. **Simulação multi-variável** (ajustar vários parâmetros)
4. **Novos simuladores**: Budget impact, Cash flow

## Especificação Técnica

### Nova Tabela

```python
class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Identificação
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))

    # Tipo
    type: Mapped[str] = mapped_column(String(30))
    # debt_payoff/goal_achievement/budget_scenario/cash_flow

    # Dados
    input_params: Mapped[dict] = mapped_column(JSONB)  # Parâmetros da simulação
    results: Mapped[dict] = mapped_column(JSONB)       # Resultados cacheados

    # Status
    is_favorite: Mapped[bool] = mapped_column(default=False)
    is_baseline: Mapped[bool] = mapped_column(default=False)  # Cenário base para comparação

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_scenarios_user_type', 'user_id', 'type'),
    )
```

### Estrutura do Módulo

```
backend/app/modules/simulators/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── scenario.py
├── schemas/
│   ├── __init__.py
│   ├── scenario.py
│   ├── debt_simulator.py
│   ├── goal_simulator.py
│   ├── budget_simulator.py
│   └── cash_flow_simulator.py
├── routers/
│   ├── __init__.py
│   └── simulators.py
└── services/
    ├── __init__.py
    ├── scenario_service.py
    ├── debt_simulator_service.py
    ├── goal_simulator_service.py
    ├── budget_simulator_service.py
    └── cash_flow_simulator_service.py
```

### Tipos de Simuladores

#### 1. Debt Payoff Simulator

**Funcionalidades:**
- Comparar Snowball vs Avalanche vs Custom order
- Simular impacto de pagamento extra
- Visualizar timeline de quitação
- Calcular economia em juros

```python
# schemas/debt_simulator.py

class DebtPayoffRequest(BaseModel):
    debt_ids: list[int] | None = None  # None = todas as dívidas
    extra_monthly_payment: Decimal = Decimal(0)
    strategy: str = "snowball"  # snowball/avalanche/custom
    custom_order: list[int] | None = None

class MonthlyPayment(BaseModel):
    month: int
    date: date
    debt_id: int
    debt_name: str
    payment: Decimal
    principal: Decimal
    interest: Decimal
    remaining_balance: Decimal
    is_payoff_month: bool

class DebtPayoffResponse(BaseModel):
    strategy: str
    total_debt: Decimal
    total_interest: Decimal
    total_paid: Decimal
    months_to_payoff: int
    payoff_date: date

    # Comparação
    savings_vs_minimum: Decimal
    months_saved_vs_minimum: int

    # Timeline
    monthly_breakdown: list[MonthlyPayment]
    payoff_order: list[str]  # Ordem de quitação

class StrategyComparison(BaseModel):
    snowball: DebtPayoffResponse
    avalanche: DebtPayoffResponse
    recommended: str
    interest_difference: Decimal
    time_difference: int
```

#### 2. Goal Achievement Simulator

**Funcionalidades:**
- Simular diferentes contribuições mensais
- "E se eu atrasasse a meta em 6 meses?"
- Impacto de aporte único
- Projeção com rentabilidade

```python
# schemas/goal_simulator.py

class GoalSimulationRequest(BaseModel):
    goal_id: int | None = None  # None = criar cenário hipotético
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    monthly_contribution: Decimal
    one_time_deposit: Decimal = Decimal(0)
    monthly_return_rate: Decimal = Decimal(0)  # 0.5% = 0.005
    target_date: date | None = None
    delay_months: int = 0  # "E se eu atrasasse..."

class GoalProjectionPoint(BaseModel):
    month: int
    date: date
    contribution: Decimal
    interest: Decimal
    balance: Decimal
    percentage_complete: float

class GoalSimulationResponse(BaseModel):
    target_amount: Decimal
    starting_amount: Decimal
    monthly_contribution: Decimal

    # Resultados
    months_to_goal: int
    completion_date: date
    total_contributions: Decimal
    total_interest: Decimal
    final_balance: Decimal

    # Análise
    on_track: bool
    shortfall: Decimal | None  # Se não atingir na target_date
    required_monthly_for_target: Decimal | None

    # Timeline
    projection: list[GoalProjectionPoint]
```

#### 3. Budget Scenario Simulator

**Funcionalidades:**
- "E se eu cortasse categoria X em Y%?"
- Impacto em metas e reserva
- Comparar cenários de corte

```python
# schemas/budget_simulator.py

class CategoryAdjustment(BaseModel):
    category_id: int
    adjustment_type: str  # percentage/absolute
    adjustment_value: Decimal  # -20 para cortar 20%, ou -200 para cortar R$200

class BudgetScenarioRequest(BaseModel):
    adjustments: list[CategoryAdjustment]
    apply_to_months: int = 12  # Período de simulação

class BudgetScenarioResponse(BaseModel):
    # Resumo das mudanças
    original_monthly_expense: Decimal
    new_monthly_expense: Decimal
    monthly_savings: Decimal
    annual_savings: Decimal

    # Por categoria
    category_impacts: list[dict]

    # Impacto em metas
    goal_impacts: list[dict]  # Quanto mais rápido atingiria

    # Impacto em reserva
    emergency_fund_impact: dict  # Meses de despesa cobertos
```

#### 4. Cash Flow Simulator

**Funcionalidades:**
- "E se eu perdesse o emprego por N meses?"
- "E se eu recebesse aumento de X%?"
- Impacto em reserva de emergência

```python
# schemas/cash_flow_simulator.py

class CashFlowEvent(BaseModel):
    event_type: str  # income_loss/income_increase/expense_increase/windfall
    start_month: int
    duration_months: int | None  # None = permanente
    amount: Decimal | None  # Valor absoluto
    percentage: Decimal | None  # Porcentagem de mudança

class CashFlowScenarioRequest(BaseModel):
    events: list[CashFlowEvent]
    simulation_months: int = 24
    include_emergency_fund: bool = True

class CashFlowScenarioResponse(BaseModel):
    # Timeline mensal
    monthly_projections: list[dict]

    # Análise
    months_until_broke: int | None  # Se reserva acabar
    emergency_fund_depletion_date: date | None
    recovery_date: date | None  # Quando voltaria ao normal

    # Recomendações
    recommended_emergency_fund: Decimal
    current_emergency_fund: Decimal
    gap: Decimal
```

### API Endpoints

```python
# routers/simulators.py

# Cenários salvos
@router.post("/scenarios")
async def save_scenario(
    data: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScenarioResponse:
    """Salva cenário para referência futura."""
    pass

@router.get("/scenarios")
async def list_scenarios(
    type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[ScenarioResponse]:
    """Lista cenários salvos."""
    pass

@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ScenarioResponse:
    pass

@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    pass

# Simulações (sem salvar)
@router.post("/debt/payoff")
async def simulate_debt_payoff(
    data: DebtPayoffRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DebtPayoffResponse:
    """Simula quitação de dívidas."""
    pass

@router.post("/debt/compare")
async def compare_debt_strategies(
    data: DebtPayoffRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StrategyComparison:
    """Compara estratégias de quitação."""
    pass

@router.post("/goal/projection")
async def simulate_goal_achievement(
    data: GoalSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GoalSimulationResponse:
    """Simula alcance de meta."""
    pass

@router.post("/budget/impact")
async def simulate_budget_changes(
    data: BudgetScenarioRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> BudgetScenarioResponse:
    """Simula impacto de mudanças no orçamento."""
    pass

@router.post("/cash-flow/projection")
async def simulate_cash_flow(
    data: CashFlowScenarioRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CashFlowScenarioResponse:
    """Simula cenários de fluxo de caixa."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   ├── Simulators.tsx            # Hub principal
│   ├── DebtSimulator.tsx         # Simulador de dívidas
│   ├── GoalSimulator.tsx         # Simulador de metas
│   ├── BudgetSimulator.tsx       # Simulador de orçamento
│   └── CashFlowSimulator.tsx     # Simulador de fluxo
└── components/simulators/
    ├── SimulatorCard.tsx         # Card para selecionar simulador
    ├── SimulatorSlider.tsx       # Input slider com valor
    ├── ScenarioCard.tsx          # Card de cenário salvo
    ├── ComparisonTable.tsx       # Tabela comparativa
    ├── PayoffTimeline.tsx        # Timeline de quitação
    ├── ProjectionChart.tsx       # Gráfico de projeção
    ├── StrategySelector.tsx      # Seletor snowball/avalanche
    └── SaveScenarioModal.tsx     # Modal para salvar
```

### Exemplo de UI: Debt Simulator

```tsx
// pages/DebtSimulator.tsx

export function DebtSimulator() {
  const [extraPayment, setExtraPayment] = useState(0);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('snowball');
  const [comparison, setComparison] = useState<StrategyComparison | null>(null);

  return (
    <div className="space-y-6">
      <h1>Simulador de Quitação de Dívidas</h1>

      {/* Controles */}
      <Card>
        <h2>Parâmetros</h2>

        <SimulatorSlider
          label="Pagamento Extra Mensal"
          value={extraPayment}
          onChange={setExtraPayment}
          min={0}
          max={2000}
          step={50}
          format="currency"
        />

        <StrategySelector
          value={strategy}
          onChange={setStrategy}
        />

        <Button onClick={runSimulation}>
          Simular
        </Button>
      </Card>

      {/* Resultados */}
      {comparison && (
        <>
          <ComparisonTable data={comparison} />

          <Card>
            <h2>Timeline de Quitação</h2>
            <PayoffTimeline data={comparison[strategy].monthly_breakdown} />
          </Card>

          <Card>
            <h2>Economia</h2>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Juros Economizados"
                value={formatCurrency(comparison[strategy].savings_vs_minimum)}
              />
              <Stat
                label="Meses Economizados"
                value={comparison[strategy].months_saved_vs_minimum}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
```

### Extensão do Debt Service Existente

```python
# debt_service.py - estender métodos existentes

async def simulate_payoff_interactive(
    self,
    user: User,
    debt_ids: list[int] | None,
    extra_monthly_payment: Decimal,
    strategy: str
) -> DebtPayoffResponse:
    """
    Wrapper interativo para simulação de quitação.
    Usa os métodos existentes mas formata para a API.
    """
    if debt_ids:
        debts = [await self.get_by_id(user, id) for id in debt_ids]
    else:
        debts = await self.list(user, only_active=True)

    if strategy == "snowball":
        plan = await self.get_snowball_plan(user, extra_monthly_payment)
    elif strategy == "avalanche":
        plan = await self.get_avalanche_plan(user, extra_monthly_payment)
    else:
        plan = await self.get_custom_plan(user, debt_ids, extra_monthly_payment)

    # Formatar para DebtPayoffResponse
    return DebtPayoffResponse(
        strategy=strategy,
        total_debt=plan["total_debt"],
        total_interest=plan["total_interest"],
        # ... etc
    )
```

## Fases de Implementação

### Fase 1 (Semana 1): Infrastructure
- [ ] Migration para simulation_scenarios
- [ ] Model SimulationScenario
- [ ] Schemas básicos

### Fase 2 (Semana 2): Debt Simulator API
- [ ] DebtSimulatorService
- [ ] Estender debt_service existente
- [ ] Endpoints de simulação

### Fase 3 (Semana 3): Goal Simulator API
- [ ] GoalSimulatorService
- [ ] Estender goal_service existente
- [ ] Endpoints de simulação

### Fase 4 (Semana 4): Frontend Debt Simulator
- [ ] DebtSimulator page
- [ ] SimulatorSlider component
- [ ] ComparisonTable
- [ ] PayoffTimeline chart

### Fase 5 (Semana 5): Frontend Goal Simulator
- [ ] GoalSimulator page
- [ ] ProjectionChart
- [ ] Scenario comparison

### Fase 6 (Semana 6): Scenarios & Polish
- [ ] ScenarioService
- [ ] Salvar/carregar cenários
- [ ] Testes

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `debt_service.py` | Adicionar wrappers para API |
| `goal_service.py` | Adicionar wrappers para API |
| `Layout.tsx` | Adicionar menu "Simuladores" |

## Critérios de Aceitação

1. [ ] Simular quitação com pagamento extra e ver economia
2. [ ] Comparar Snowball vs Avalanche
3. [ ] Gráfico de timeline de quitação
4. [ ] Simular meta com diferentes contribuições
5. [ ] Salvar cenário para comparação futura
6. [ ] Sliders responsivos com feedback imediato
