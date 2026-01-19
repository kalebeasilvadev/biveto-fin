# Backlog #8: Onboarding com Quick Win

## Status: 📋 Planejado

## Descrição

Fluxo de onboarding rápido que guia novos usuários até uma "vitória" inicial, aumentando a probabilidade de engajamento e retenção.

## Conceito

O onboarding com "quick win" é baseado em pesquisas de UX que mostram que:

1. Usuários que completam uma ação significativa nas primeiras sessões têm maior retenção
2. Pequenas vitórias geram motivação para continuar
3. Um fluxo guiado reduz a "paralisia por análise"

**Quick Win = Ver o dashboard funcionando com dados reais**

## Especificação Técnica

### Nova Tabela

```python
class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Status geral
    is_completed: Mapped[bool] = mapped_column(default=False)
    completed_at: Mapped[datetime | None]
    skipped_at: Mapped[datetime | None]

    # Steps
    steps_completed: Mapped[dict] = mapped_column(JSONB, default={})
    # {
    #   "welcome": {"completed_at": "2024-01-15T10:00:00"},
    #   "create_account": {"completed_at": "...", "account_id": 1},
    #   "first_transaction": {"completed_at": "...", "transaction_id": 5},
    #   "view_dashboard": {"completed_at": "..."}
    # }

    # Progresso
    current_step: Mapped[str] = mapped_column(String(50), default="welcome")
    progress_percentage: Mapped[int] = mapped_column(default=0)

    # Analytics
    started_at: Mapped[datetime] = mapped_column(default=func.now())
    last_interaction_at: Mapped[datetime] = mapped_column(default=func.now())
    total_time_seconds: Mapped[int] = mapped_column(default=0)

    # Configurações escolhidas
    preferences: Mapped[dict] = mapped_column(JSONB, default={})
    # {
    #   "currency": "BRL",
    #   "first_day_of_month": 1,
    #   "notification_preference": "essential"
    # }
```

### Estrutura do Módulo

```
backend/app/modules/onboarding/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── onboarding.py
├── schemas/
│   ├── __init__.py
│   └── onboarding.py
├── routers/
│   ├── __init__.py
│   └── onboarding.py
└── services/
    ├── __init__.py
    └── onboarding_service.py
```

### Steps do Onboarding

```python
ONBOARDING_STEPS = [
    {
        "id": "welcome",
        "title": "Bem-vindo ao Biveto!",
        "description": "Vamos configurar sua conta em menos de 3 minutos",
        "duration_seconds": 30,
        "is_required": True,
        "action": None,  # Apenas visualização
    },
    {
        "id": "create_account",
        "title": "Crie sua primeira conta",
        "description": "Pode ser sua conta corrente, carteira ou poupança",
        "duration_seconds": 60,
        "is_required": True,
        "action": "create_account",
        "validation": {
            "type": "entity_exists",
            "entity": "account"
        }
    },
    {
        "id": "first_transaction",
        "title": "Registre uma transação",
        "description": "Adicione uma receita ou despesa recente",
        "duration_seconds": 60,
        "is_required": True,
        "action": "create_transaction",
        "validation": {
            "type": "entity_exists",
            "entity": "transaction"
        }
    },
    {
        "id": "view_dashboard",
        "title": "Pronto! Conheça seu dashboard",
        "description": "Aqui você verá o resumo das suas finanças",
        "duration_seconds": 30,
        "is_required": True,
        "action": "navigate",
        "target": "/dashboard"
    },
    {
        "id": "next_steps",
        "title": "Próximos passos",
        "description": "Sugestões para continuar organizando suas finanças",
        "duration_seconds": 30,
        "is_required": False,
        "suggestions": [
            {"action": "import_statement", "label": "Importar extrato"},
            {"action": "create_budget", "label": "Criar orçamento"},
            {"action": "create_goal", "label": "Definir uma meta"},
            {"action": "connect_bank", "label": "Conectar banco (em breve)"}
        ]
    }
]
```

### Schemas

```python
# schemas/onboarding.py

class OnboardingStep(BaseModel):
    id: str
    title: str
    description: str
    duration_seconds: int
    is_required: bool
    is_completed: bool
    completed_at: datetime | None
    action: str | None
    target: str | None

class OnboardingProgress(BaseModel):
    is_completed: bool
    current_step: str
    progress_percentage: int
    steps: list[OnboardingStep]
    total_estimated_time: int  # segundos
    time_remaining: int  # segundos

class OnboardingStepComplete(BaseModel):
    step_id: str
    data: dict | None = None  # Ex: {"account_id": 1}

class OnboardingPreferences(BaseModel):
    currency: str = "BRL"
    first_day_of_month: int = 1
    notification_preference: str = "essential"  # all/essential/minimal
```

### Serviço

```python
class OnboardingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_progress(
        self,
        user: User
    ) -> OnboardingProgress:
        """
        Retorna o progresso atual do onboarding.
        Cria registro se não existir.
        """
        pass

    async def complete_step(
        self,
        user: User,
        step_id: str,
        data: dict | None = None
    ) -> OnboardingProgress:
        """
        Marca um step como completo.
        Valida se a ação foi realmente realizada.
        """
        pass

    async def skip_onboarding(
        self,
        user: User
    ) -> None:
        """Pula o onboarding (usuário experiente)."""
        pass

    async def save_preferences(
        self,
        user: User,
        preferences: OnboardingPreferences
    ) -> None:
        """Salva preferências escolhidas durante onboarding."""
        pass

    async def should_show_onboarding(
        self,
        user: User
    ) -> bool:
        """Verifica se deve mostrar onboarding."""
        pass

    async def get_suggested_next_steps(
        self,
        user: User
    ) -> list[dict]:
        """
        Retorna próximos passos sugeridos baseado
        no que o usuário já tem configurado.
        """
        pass

    async def _validate_step(
        self,
        user: User,
        step_id: str
    ) -> bool:
        """Valida se a ação do step foi realizada."""
        step = self._get_step_config(step_id)

        if not step.get("validation"):
            return True

        validation = step["validation"]

        if validation["type"] == "entity_exists":
            entity = validation["entity"]
            if entity == "account":
                return await self._has_account(user)
            elif entity == "transaction":
                return await self._has_transaction(user)

        return True
```

### API Endpoints

```python
@router.get("/progress")
async def get_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> OnboardingProgress:
    """Retorna progresso do onboarding."""
    pass

@router.post("/steps/{step_id}/complete")
async def complete_step(
    step_id: str,
    data: dict | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> OnboardingProgress:
    """Marca step como completo."""
    pass

@router.post("/skip")
async def skip_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Pula onboarding."""
    pass

@router.put("/preferences")
async def save_preferences(
    preferences: OnboardingPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Salva preferências."""
    pass

@router.get("/should-show")
async def should_show(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Verifica se deve mostrar onboarding."""
    pass

@router.get("/next-steps")
async def get_next_steps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Próximos passos sugeridos."""
    pass
```

### Frontend Components

```
frontend/src/
├── pages/
│   └── Onboarding.tsx
└── components/onboarding/
    ├── OnboardingWizard.tsx      # Container principal
    ├── OnboardingProgress.tsx    # Barra de progresso
    ├── OnboardingStep.tsx        # Step genérico
    ├── WelcomeStep.tsx           # Step 1
    ├── CreateAccountStep.tsx     # Step 2
    ├── FirstTransactionStep.tsx  # Step 3
    ├── DashboardPreviewStep.tsx  # Step 4
    ├── NextStepsStep.tsx         # Step 5
    ├── OnboardingSkipButton.tsx  # Botão pular
    └── QuickAccountForm.tsx      # Form simplificado
```

### Exemplo de UI

```tsx
// pages/Onboarding.tsx

export function Onboarding() {
  const { data: progress } = useOnboardingProgress();
  const completeStep = useCompleteStep();
  const navigate = useNavigate();

  if (!progress || progress.is_completed) {
    return <Navigate to="/dashboard" />;
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === progress.current_step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Progress */}
        <OnboardingProgress
          current={currentStepIndex}
          total={STEPS.length}
          percentage={progress.progress_percentage}
        />

        {/* Step Content */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={progress.current_step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {progress.current_step === 'welcome' && (
                <WelcomeStep onComplete={() => completeStep('welcome')} />
              )}
              {progress.current_step === 'create_account' && (
                <CreateAccountStep
                  onComplete={(accountId) => completeStep('create_account', { account_id: accountId })}
                />
              )}
              {progress.current_step === 'first_transaction' && (
                <FirstTransactionStep
                  onComplete={(txId) => completeStep('first_transaction', { transaction_id: txId })}
                />
              )}
              {progress.current_step === 'view_dashboard' && (
                <DashboardPreviewStep
                  onComplete={() => {
                    completeStep('view_dashboard');
                    navigate('/dashboard');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip */}
        <div className="mt-8 text-center">
          <OnboardingSkipButton />
        </div>
      </div>
    </div>
  );
}
```

### Welcome Step

```tsx
// components/onboarding/WelcomeStep.tsx

export function WelcomeStep({ onComplete }) {
  return (
    <Card className="text-center">
      <div className="text-6xl mb-4">👋</div>

      <h1 className="text-2xl font-bold mb-2">
        Bem-vindo ao Biveto!
      </h1>

      <p className="text-gray-600 mb-6">
        Vamos configurar sua conta em menos de 3 minutos.
        Ao final, você terá uma visão clara das suas finanças.
      </p>

      <div className="space-y-3 text-left mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-500" size={20} />
          <span>Crie sua primeira conta</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-500" size={20} />
          <span>Registre uma transação</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-500" size={20} />
          <span>Veja seu dashboard funcionando!</span>
        </div>
      </div>

      <Button onClick={onComplete} size="lg" className="w-full">
        Começar →
      </Button>
    </Card>
  );
}
```

### Create Account Step (Simplificado)

```tsx
// components/onboarding/CreateAccountStep.tsx

export function CreateAccountStep({ onComplete }) {
  const [type, setType] = useState<'checking' | 'wallet' | 'savings'>('checking');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const createAccount = useCreateAccount();

  const handleSubmit = async () => {
    const account = await createAccount.mutateAsync({
      name: name || `Minha ${typeLabels[type]}`,
      type,
      initial_balance: parseFloat(balance) || 0,
    });
    onComplete(account.id);
  };

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-4">
        Crie sua primeira conta
      </h2>

      <p className="text-gray-600 mb-6">
        Pode ser sua conta corrente, carteira ou poupança.
      </p>

      {/* Tipo */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(['checking', 'wallet', 'savings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "p-3 rounded-lg border text-center",
              type === t ? "border-blue-500 bg-blue-50" : "border-gray-200"
            )}
          >
            <div className="text-2xl mb-1">{typeIcons[t]}</div>
            <div className="text-sm">{typeLabels[t]}</div>
          </button>
        ))}
      </div>

      {/* Nome */}
      <Input
        label="Nome (opcional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Minha ${typeLabels[type]}`}
        className="mb-4"
      />

      {/* Saldo */}
      <CurrencyInput
        label="Saldo atual"
        value={balance}
        onChange={setBalance}
        className="mb-6"
      />

      <Button onClick={handleSubmit} className="w-full">
        Criar conta
      </Button>
    </Card>
  );
}
```

## Fases de Implementação

### Fase 1 (Semana 1): Backend
- [ ] Migration para user_onboarding
- [ ] Model
- [ ] OnboardingService
- [ ] Endpoints

### Fase 2 (Semana 2): Frontend
- [ ] OnboardingWizard
- [ ] Todos os steps
- [ ] Animações

### Fase 3 (Semana 3): Polish
- [ ] Testes
- [ ] Analytics
- [ ] Ajustes de UX

## Integração no App

```tsx
// App.tsx ou PrivateRoute.tsx

function PrivateRoute({ children }) {
  const { data: shouldShow } = useShouldShowOnboarding();

  if (shouldShow) {
    return <Navigate to="/onboarding" />;
  }

  return children;
}
```

## Critérios de Aceitação

1. [ ] Novo usuário é direcionado para onboarding
2. [ ] Pode pular onboarding
3. [ ] Step de criar conta funciona
4. [ ] Step de transação funciona
5. [ ] Dashboard é mostrado ao final
6. [ ] Progresso é salvo (pode continuar depois)
7. [ ] Animações fluidas entre steps
