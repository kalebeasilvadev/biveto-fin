# Backlog #7: Educação Contextual (Microlearning)

## Status: 📋 Planejado

## Descrição

Dicas curtas e contextuais exibidas no momento certo, educando o usuário sobre conceitos financeiros relevantes para a ação que está realizando.

## Conceito

Microlearning é uma técnica de educação que entrega conhecimento em pequenas doses, no momento em que é mais relevante. Exemplos:

- Ao criar uma dívida com juros altos → explicar CET
- Ao ver cartão de crédito → explicar como funciona o rotativo
- Ao criar meta de emergência → explicar a regra dos 3-6 meses

## Especificação Técnica

### Estrutura de Tips

```typescript
// types/education.ts

interface FinancialTip {
  id: string;
  contexts: string[];  // Onde exibir: ['debt_create', 'credit_card_view']
  trigger?: {
    type: 'always' | 'condition';
    condition?: string;  // Ex: "debt.interest_rate > 2"
  };
  title: string;
  content: string;
  icon: string;
  category: 'basic' | 'intermediate' | 'advanced';
  link?: {
    url: string;
    label: string;
  };
  priority: number;  // 1-10, para ordenar quando múltiplas tips
}

interface UserTipInteraction {
  tipId: string;
  userId: number;
  dismissedAt?: Date;
  helpfulRating?: 1 | 2 | 3 | 4 | 5;
  viewCount: number;
  lastViewedAt: Date;
}
```

### Nova Tabela

```python
class UserTipInteraction(Base):
    __tablename__ = "user_tip_interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tip_id: Mapped[str] = mapped_column(String(50))

    # Status
    is_dismissed: Mapped[bool] = mapped_column(default=False)
    dismissed_at: Mapped[datetime | None]

    # Feedback
    helpful_rating: Mapped[int | None]  # 1-5

    # Analytics
    view_count: Mapped[int] = mapped_column(default=0)
    first_viewed_at: Mapped[datetime] = mapped_column(default=func.now())
    last_viewed_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'tip_id'),
        Index('ix_tip_interactions_user', 'user_id'),
    )
```

### Banco de Tips

```python
# data/financial_tips.py

FINANCIAL_TIPS = [
    # === DÍVIDAS ===
    {
        "id": "debt_cet_explanation",
        "contexts": ["debt_create", "debt_edit"],
        "trigger": {"type": "always"},
        "title": "O que é CET?",
        "content": """
O **Custo Efetivo Total (CET)** é a taxa que representa o custo real
de um empréstimo ou financiamento, incluindo juros, taxas e seguros.

Sempre compare o CET, não apenas a taxa de juros anunciada!
        """,
        "icon": "info-circle",
        "category": "basic",
        "priority": 8
    },
    {
        "id": "debt_snowball_method",
        "contexts": ["debt_list", "simulator_debt"],
        "trigger": {"type": "condition", "condition": "debts.count > 2"},
        "title": "Método Bola de Neve",
        "content": """
Com múltiplas dívidas, considere o **método bola de neve**:

1. Pague o mínimo em todas
2. Coloque extra na menor dívida
3. Ao quitar, vá para a próxima

Gera motivação ao ver dívidas sendo eliminadas!
        """,
        "icon": "snowflake",
        "category": "intermediate",
        "link": {"url": "/simulators/debt", "label": "Simular"},
        "priority": 7
    },
    {
        "id": "debt_avalanche_method",
        "contexts": ["simulator_debt"],
        "title": "Método Avalanche",
        "content": """
O **método avalanche** prioriza as dívidas com maior taxa de juros.

Matematicamente é o mais eficiente, mas exige mais disciplina.

Compare os dois métodos no simulador!
        """,
        "icon": "trending-down",
        "category": "intermediate",
        "priority": 6
    },

    # === CARTÃO DE CRÉDITO ===
    {
        "id": "credit_card_rotativo",
        "contexts": ["credit_card_invoice", "credit_card_view"],
        "trigger": {"type": "condition", "condition": "invoice.is_overdue"},
        "title": "Cuidado com o Rotativo!",
        "content": """
O **crédito rotativo** do cartão tem as maiores taxas do mercado
(até 400% ao ano!).

Se não puder pagar a fatura inteira, negocie um parcelamento
com taxa menor antes do vencimento.
        """,
        "icon": "alert-triangle",
        "category": "basic",
        "priority": 10
    },
    {
        "id": "credit_card_best_practices",
        "contexts": ["credit_card_create"],
        "title": "Cartão: Aliado ou Vilão?",
        "content": """
O cartão de crédito pode ser um aliado se você:

✅ Pagar sempre a fatura total
✅ Usar o período de graça a seu favor
✅ Não gastar mais do que recebe

Defina um limite pessoal abaixo do limite do banco!
        """,
        "icon": "credit-card",
        "category": "basic",
        "priority": 7
    },

    # === METAS ===
    {
        "id": "goal_emergency_fund",
        "contexts": ["goal_create", "goal_edit"],
        "trigger": {"type": "condition", "condition": "goal.type == 'emergency_fund'"},
        "title": "Reserva de Emergência",
        "content": """
A **reserva de emergência** deve cobrir de 3 a 6 meses de despesas.

- CLT: 3-4 meses
- Autônomo: 6-12 meses

Mantenha em investimento de alta liquidez (ex: CDB liquidez diária).
        """,
        "icon": "shield",
        "category": "basic",
        "priority": 9
    },
    {
        "id": "goal_compound_interest",
        "contexts": ["goal_view", "simulator_goal"],
        "title": "O Poder dos Juros Compostos",
        "content": """
Albert Einstein chamou os juros compostos de "a oitava maravilha do mundo".

Quanto antes você começar, mais o tempo trabalha a seu favor.
R$200/mês por 30 anos a 10% ao ano = R$452.000!
        """,
        "icon": "trending-up",
        "category": "intermediate",
        "priority": 8
    },

    # === ORÇAMENTO ===
    {
        "id": "budget_50_30_20",
        "contexts": ["budget_create", "budget_edit"],
        "title": "Regra 50-30-20",
        "content": """
Uma forma simples de organizar o orçamento:

- **50%** Necessidades (moradia, alimentação, saúde)
- **30%** Desejos (lazer, assinaturas, compras)
- **20%** Prioridades financeiras (poupança, dívidas)

Adapte os percentuais à sua realidade!
        """,
        "icon": "pie-chart",
        "category": "basic",
        "priority": 8
    },
    {
        "id": "budget_envelope",
        "contexts": ["envelope_create"],
        "title": "Sistema de Envelopes",
        "content": """
O **envelope budgeting** é uma técnica comprovada:

1. Defina quanto gastar por categoria
2. "Coloque" o dinheiro no envelope virtual
3. Quando acabar, pare de gastar

Funciona porque torna o limite tangível!
        """,
        "icon": "mail",
        "category": "intermediate",
        "priority": 7
    },

    # === INVESTIMENTOS ===
    {
        "id": "investment_diversification",
        "contexts": ["account_create"],
        "trigger": {"type": "condition", "condition": "account.type == 'investment'"},
        "title": "Diversificação",
        "content": """
"Não coloque todos os ovos na mesma cesta."

Diversificar entre classes de ativos (renda fixa, ações, imóveis)
reduz o risco sem necessariamente reduzir o retorno.
        """,
        "icon": "layers",
        "category": "intermediate",
        "priority": 6
    },

    # === GERAL ===
    {
        "id": "general_pay_yourself_first",
        "contexts": ["income_create", "transaction_income"],
        "title": "Pague-se Primeiro",
        "content": """
Ao receber seu salário, **separe a poupança antes de gastar**.

Se esperar sobrar no final do mês, raramente sobrará.
Automatize uma transferência para o dia do pagamento!
        """,
        "icon": "piggy-bank",
        "category": "basic",
        "priority": 9
    },
    {
        "id": "general_lifestyle_inflation",
        "contexts": ["income_edit"],
        "trigger": {"type": "condition", "condition": "income.amount > previous_amount"},
        "title": "Inflação do Estilo de Vida",
        "content": """
Recebeu um aumento? Parabéns! 🎉

Cuidado com a **inflação do estilo de vida**:
aumentar gastos proporcionalmente ao salário.

Direcione pelo menos metade do aumento para investimentos!
        """,
        "icon": "trending-up",
        "category": "intermediate",
        "priority": 7
    }
]
```

### Estrutura do Módulo

```
backend/app/modules/education/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── tip_interaction.py
├── schemas/
│   ├── __init__.py
│   └── tip.py
├── routers/
│   ├── __init__.py
│   └── tips.py
├── services/
│   ├── __init__.py
│   └── tip_service.py
└── data/
    ├── __init__.py
    └── financial_tips.py
```

### Serviço

```python
class TipService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tips_for_context(
        self,
        user: User,
        context: str,
        condition_data: dict | None = None,
        limit: int = 2
    ) -> list[TipResponse]:
        """
        Retorna tips relevantes para um contexto.
        Filtra tips já dispensadas pelo usuário.
        Avalia condições se houver.
        """
        pass

    async def dismiss_tip(
        self,
        user: User,
        tip_id: str
    ) -> None:
        """Marca tip como dispensada (não mostrar novamente)."""
        pass

    async def rate_tip(
        self,
        user: User,
        tip_id: str,
        rating: int
    ) -> None:
        """Registra feedback do usuário sobre a tip."""
        pass

    async def record_view(
        self,
        user: User,
        tip_id: str
    ) -> None:
        """Registra visualização para analytics."""
        pass

    async def get_dismissed_tips(
        self,
        user: User
    ) -> list[str]:
        """Retorna IDs de tips dispensadas."""
        pass

    async def reset_dismissed_tips(
        self,
        user: User
    ) -> None:
        """Reseta tips dispensadas (para configurações)."""
        pass

    def _evaluate_condition(
        self,
        condition: str,
        data: dict
    ) -> bool:
        """Avalia condição da tip com os dados fornecidos."""
        pass
```

### API Endpoints

```python
@router.get("/tips")
async def get_tips(
    context: str,
    limit: int = 2,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[TipResponse]:
    """Retorna tips para um contexto."""
    pass

@router.post("/tips/{tip_id}/dismiss")
async def dismiss_tip(
    tip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Dispensa uma tip."""
    pass

@router.post("/tips/{tip_id}/rate")
async def rate_tip(
    tip_id: str,
    rating: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Avalia uma tip."""
    pass

@router.post("/tips/{tip_id}/view")
async def record_view(
    tip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Registra visualização."""
    pass

@router.post("/tips/reset")
async def reset_tips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Reseta tips dispensadas."""
    pass
```

### Frontend Components

```
frontend/src/components/education/
├── ContextualTip.tsx         # Componente principal
├── TipCard.tsx               # Card de tip
├── TipDismissButton.tsx      # Botão dispensar
├── TipRating.tsx             # Rating 1-5
└── TipLink.tsx               # Link para mais info
```

### Componente Principal

```tsx
// components/education/ContextualTip.tsx

interface ContextualTipProps {
  context: string;
  conditionData?: Record<string, any>;
  maxTips?: number;
  className?: string;
}

export function ContextualTip({
  context,
  conditionData,
  maxTips = 1,
  className
}: ContextualTipProps) {
  const { data: tips, isLoading } = useTips(context, conditionData);
  const dismissTip = useDismissTip();

  if (isLoading || !tips?.length) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {tips.slice(0, maxTips).map(tip => (
        <TipCard
          key={tip.id}
          tip={tip}
          onDismiss={() => dismissTip.mutate(tip.id)}
        />
      ))}
    </div>
  );
}

// components/education/TipCard.tsx

export function TipCard({ tip, onDismiss }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Icon name={tip.icon} className="text-blue-600 mt-1" />

        <div className="flex-1">
          <h4 className="font-medium text-blue-900">{tip.title}</h4>
          <div className="text-sm text-blue-800 mt-1">
            <Markdown>{tip.content}</Markdown>
          </div>

          {tip.link && (
            <Link
              to={tip.link.url}
              className="text-sm text-blue-600 hover:underline mt-2 inline-block"
            >
              {tip.link.label} →
            </Link>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="text-blue-400 hover:text-blue-600"
          aria-label="Dispensar dica"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
```

### Integração nas Páginas

```tsx
// pages/Debts.tsx (exemplo)

export function Debts() {
  const { data: debts } = useDebts();

  return (
    <div>
      <h1>Dívidas</h1>

      {/* Tip contextual */}
      <ContextualTip
        context="debt_list"
        conditionData={{ debts: { count: debts?.length || 0 } }}
        className="mb-4"
      />

      {/* Conteúdo da página */}
      <DebtList debts={debts} />
    </div>
  );
}
```

## Fases de Implementação

### Fase 1 (Semana 1): Structure
- [ ] Migration para user_tip_interactions
- [ ] Model
- [ ] Banco de tips (financial_tips.py)

### Fase 2 (Semana 2): Service + API
- [ ] TipService
- [ ] Endpoints
- [ ] Condição evaluation

### Fase 3 (Semana 3): Frontend
- [ ] ContextualTip component
- [ ] TipCard component
- [ ] Integrar em páginas principais

## Critérios de Aceitação

1. [ ] Tip aparece ao criar dívida
2. [ ] Tip pode ser dispensada
3. [ ] Tip dispensada não aparece mais
4. [ ] Condições funcionam (ex: múltiplas dívidas)
5. [ ] Rating é registrado
6. [ ] Reset de tips funciona nas configurações
