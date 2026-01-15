# Documento de Melhorias e Correções - Gestão Familiar Biveto

**Versão:** 1.0
**Data:** 2026-01-15
**Autor:** Análise Técnica Completa do Sistema

---

## Índice

1. [Contexto e Arquitetura Atual](#1-contexto-e-arquitetura-atual)
2. [Problemas Identificados](#2-problemas-identificados)
3. [Modelo de Dados e Hierarquia](#3-modelo-de-dados-e-hierarquia)
4. [Regras de Negócio Propostas](#4-regras-de-negócio-propostas)
5. [Plano de Implementação Completo](#5-plano-de-implementação-completo)
6. [Validações por Módulo](#6-validações-por-módulo)
7. [Casos de Uso e Cenários](#7-casos-de-uso-e-cenários)
8. [Testes Necessários](#8-testes-necessários)
9. [Migração de Dados](#9-migração-de-dados)
10. [Documentação para Usuários](#10-documentação-para-usuários)

---

## 1. Contexto e Arquitetura Atual

### 1.1 Estrutura de Licenças

O sistema Biveto utiliza um modelo de **licenciamento familiar** onde:

```
License (Plano Familiar)
  ├── Owner (Titular da licença)
  └── HouseholdMembers (Membros da família)
       ├── Member 1 (user_id, license_id, permissions)
       ├── Member 2 (user_id, license_id, permissions)
       └── Member N (user_id, license_id, permissions)
```

**Características atuais:**
- Cada User tem um `license_id` que o vincula a uma licença
- Uma License pode ter múltiplos HouseholdMembers
- Cada HouseholdMember representa a relação de um User com uma License
- O Owner da license é o primeiro membro (`is_first_member=True`)

### 1.2 Modelo de Propriedade (Ownership)

Todos os recursos financeiros (transações, contas, metas, etc.) têm um campo `ownership_type`:

```python
class OwnershipType(str, Enum):
    PERSONAL = "personal"    # Visível apenas para o criador
    HOUSEHOLD = "household"  # Visível para toda a família
```

### 1.3 Permissões de Membros

```python
class HouseholdMember:
    can_create_transactions: bool = True   # Pode criar transações
    can_edit_shared: bool = True           # Pode editar recursos household
    can_invite_members: bool = False       # Pode convidar novos membros
    can_see_all: bool = False              # Pode ver TODOS os recursos (incluindo personal de outros)
```

### 1.4 Estado Atual da Implementação

#### ✅ Módulos com Implementação COMPLETA:
1. **Transactions** - Backend + Frontend
2. **Accounts** - Backend + Frontend (parcial)
3. **Income Sources** - Backend + Frontend (parcial)
4. **Credit Cards** - Backend (com limitações)
5. **Analytics** - Backend considera household
6. **Financial Agent/Chat** - Backend considera household

#### ❌ Módulos com Implementação INCOMPLETA:
1. **Budgets** - Sem filtro household
2. **Goals** - Sem filtro household
3. **Debts** - Sem filtro household
4. **Recurring Transactions** - Sem filtro household
5. **Documents/Upload PDF** - Sem seletor ownership no frontend
6. **Credit Cards** - Hardcoded como personal na criação

---

## 2. Problemas Identificados

### 2.1 🚨 CRÍTICOS - Quebram a Experiência Familiar

#### Problema 1: Upload de PDF Sem Seletor de Ownership
**Localização:** `frontend/src/components/upload/ExtractedItemsList.tsx`

**Descrição:**
Quando um usuário faz upload de uma fatura em PDF e confirma as transações:
- ❌ NÃO há opção para escolher "Personal" ou "Household"
- ❌ TODAS as transações ficam como "personal" por padrão
- ❌ Membros da família NÃO veem essas transações

**Impacto:**
- Famílias que fazem upload de faturas compartilhadas (água, luz, internet, mercado) não conseguem compartilhar essas despesas
- Duplicação de lançamentos se dois membros tentarem registrar a mesma fatura
- Relatórios e analytics ficam incompletos

**Arquivos afetados:**
- `frontend/src/components/upload/ExtractedItemsList.tsx`
- `frontend/src/pages/Upload.tsx`
- `backend/app/modules/transactions/schemas/transaction.py:45`

---

#### Problema 2: Orçamentos Não Consideram Household
**Localização:** `backend/app/modules/budgets/services/budget_service.py`

**Descrição:**
- ❌ Orçamentos apenas filtram por `user_id == current_user.id`
- ❌ Não há opção de criar orçamento familiar compartilhado
- ❌ Não há seletor de ownership no frontend

**Impacto:**
- Família não consegue criar orçamento familiar unificado
- Cada membro cria seu próprio orçamento, causando inconsistências
- Dificuldade em controlar gastos familiares conjuntos

**Arquivos afetados:**
- `backend/app/modules/budgets/services/budget_service.py:59` (método `_get_expenses_by_category`)
- `backend/app/modules/budgets/routers/budgets.py` (todos os endpoints)
- `frontend/src/pages/Budgets.tsx` (se existir)

---

#### Problema 3: Metas Não Consideram Household
**Localização:** `backend/app/modules/goals/services/goal_service.py`

**Descrição:**
- ❌ Metas apenas filtram por `user_id == current_user.id`
- ❌ Família não pode criar meta compartilhada (ex: "Viagem em família")
- ❌ Contribuições de diferentes membros não são consolidadas

**Impacto:**
- Impossibilidade de metas financeiras familiares colaborativas
- Meta de "Fundo de Emergência Familiar" fica fragmentada
- Perda de motivação por falta de visão unificada do progresso

**Arquivos afetados:**
- `backend/app/modules/goals/services/goal_service.py:30` (método `list_goals`)
- `backend/app/modules/goals/routers/goals.py`
- `frontend/src/pages/Goals.tsx` (se existir)

---

#### Problema 4: Dívidas Não Consideram Household
**Localização:** `backend/app/modules/debts/services/debt_service.py`

**Descrição:**
- ❌ Dívidas apenas filtram por `user_id == current_user.id`
- ❌ Dívidas familiares (financiamento imobiliário, empréstimo conjunto) não são compartilhadas
- ❌ Planos Snowball/Avalanche não consideram dívidas de outros membros

**Impacto:**
- Visão fragmentada do endividamento familiar
- Impossibilidade de estratégia de quitação familiar unificada
- Cada membro vê apenas suas próprias dívidas

**Arquivos afetados:**
- `backend/app/modules/debts/services/debt_service.py:28` (método `list_debts`)
- `backend/app/modules/debts/routers/debts.py`
- `frontend/src/pages/Debts.tsx` (se existir)

---

#### Problema 5: Transações Recorrentes Não Consideram Household
**Localização:** `backend/app/modules/recurring/services/recurring_service.py`

**Descrição:**
- ❌ Recorrentes apenas filtram por `user_id == current_user.id`
- ❌ Assinaturas familiares (Netflix, Spotify, Academia) não são compartilhadas
- ❌ Ao criar recorrente de fatura, não permite escolher ownership

**Impacto:**
- Duplicação de recorrentes (dois membros cadastram o mesmo Netflix)
- Análise de gastos recorrentes incompleta
- Inconsistência com transações que são household

**Arquivos afetados:**
- `backend/app/modules/recurring/services/recurring_service.py` (métodos `list`, `create`)
- `backend/app/modules/recurring/routers/recurring.py:249` (método `create_from_suggestion`)
- `frontend/src/pages/Recurring.tsx` (se existir)

---

### 2.2 ⚠️ IMPORTANTES - Limitam Funcionalidades

#### Problema 6: Criação de Conta/Cartão Hardcoded como Personal
**Localização:** `backend/app/modules/credit_cards/routers/credit_cards.py:134`

**Descrição:**
```python
account = Account(
    user_id=current_user.id,
    ownership_type="personal",  # ← HARDCODED
)
```

**Impacto:**
- Impossível criar conta corrente familiar compartilhada
- Impossível criar cartão de crédito familiar
- Transações household ficam vinculadas a contas personal

**Arquivos afetados:**
- `backend/app/modules/credit_cards/routers/credit_cards.py:134`
- `backend/app/modules/accounts/routers/accounts.py:129-149`
- `frontend/src/pages/Accounts.tsx:66` (formData inicial)
- `frontend/src/pages/CreditCards.tsx` (se existir)

---

#### Problema 7: Permissões Não Validadas
**Localização:** Vários endpoints

**Descrição:**
- ❌ `can_create_transactions` - Não é validado em nenhum endpoint
- ❌ `can_edit_shared` - Não é validado ao editar recursos household
- ❌ `can_see_all` - Campo existe mas não é usado nas queries

**Impacto:**
- Qualquer membro pode criar transações mesmo sem permissão
- Qualquer membro pode editar recursos compartilhados sem validação
- Falta de controle granular sobre permissões familiares

**Arquivos afetados:**
- `backend/app/modules/transactions/routers/transactions.py:146` (create)
- `backend/app/modules/transactions/routers/transactions.py:184` (update)
- `backend/app/modules/accounts/routers/accounts.py` (create/update)
- Todos os demais routers de recursos

---

#### Problema 8: Analytics Inconsistente
**Localização:** `backend/app/modules/analytics/services/analytics_service.py`

**Descrição:**
- ✅ Analytics considera transações household
- ⚠️ MAS ignora orçamentos, metas e dívidas household (porque não existem)
- ⚠️ Relatórios ficam incompletos e inconsistentes

**Impacto:**
- Dashboard familiar mostra gastos mas não mostra orçamento familiar
- Insights sobre dívidas ignoram dívidas de outros membros
- Análise de progresso de metas ignora contribuições de outros membros

**Arquivos afetados:**
- `backend/app/modules/analytics/services/analytics_service.py:430-477`

---

### 2.3 🟡 MÉDIOS - Melhorias de UX

#### Problema 9: Falta Indicação Visual de Ownership
**Descrição:**
- Transações household não têm indicador visual claro
- Usuário não sabe quem criou a transação household
- Falta tooltip/badge mostrando "Criado por João"

**Impacto:**
- Confusão sobre origem das transações compartilhadas
- Dificuldade em identificar quem lançou determinada despesa

---

#### Problema 10: Falta Auditoria/Histórico
**Descrição:**
- Não há log de quem editou recursos household
- Não há histórico de alterações
- Impossível rastrear mudanças em orçamentos/metas compartilhadas

**Impacto:**
- Conflitos entre membros sobre quem modificou o quê
- Impossibilidade de reverter alterações acidentais

---

### 2.4 🟢 BAIXOS - Melhorias Futuras

#### Problema 11: Notificações
- Não há notificação quando membro adiciona transação household
- Não há alerta quando orçamento familiar é ultrapassado
- Falta comunicação entre membros

#### Problema 12: Aprovações/Workflows
- Grandes despesas household não requerem aprovação
- Falta workflow para transações acima de X reais
- Impossível configurar regras de aprovação

---

## 3. Modelo de Dados e Hierarquia

### 3.1 Entidades Principais

```
┌─────────────────────────────────────────────────────────────┐
│                          License                            │
│  - id: int                                                  │
│  - type: "free" | "premium" | "family"                      │
│  - max_members: int                                         │
│  - owner_user_id: int                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ 1:N
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     HouseholdMember                         │
│  - id: int                                                  │
│  - license_id: int         → FK para License                │
│  - user_id: int            → FK para User                   │
│  - role: "owner" | "admin" | "member"                       │
│  - nickname: str | None                                     │
│  - can_create_transactions: bool = True                     │
│  - can_edit_shared: bool = True                             │
│  - can_invite_members: bool = False                         │
│  - can_see_all: bool = False                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ N:1
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                           User                              │
│  - id: int                                                  │
│  - email: str                                               │
│  - name: str                                                │
│  - license_id: int | None  → FK para License                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Recursos com Ownership

Todos os recursos abaixo herdam o padrão de ownership:

```python
class ResourceWithOwnership:
    user_id: int               # Quem criou o recurso
    ownership_type: OwnershipType  # "personal" ou "household"
```

**Recursos afetados:**
1. Transaction
2. Account
3. IncomeSource
4. Budget
5. Goal
6. Debt
7. RecurringTransaction
8. CreditCard (via Account)

### 3.3 Regras de Visibilidade

```
SE usuário NÃO tem license_id:
    ├─ Vê apenas seus próprios recursos (user_id = current_user.id)
    └─ ownership_type é ignorado

SE usuário TEM license_id:
    ├─ Vê recursos PERSONAL criados por ele (user_id = current_user.id AND ownership_type = "personal")
    └─ Vê recursos HOUSEHOLD de qualquer membro da família (user_id IN household_user_ids AND ownership_type = "household")
```

---

## 4. Regras de Negócio Propostas

### 4.1 Criação de Recursos

#### Regra 1: Default de Ownership
```
SE member_count < 2:
    ├─ ownership_type = "personal" (sem opção de escolha)
    └─ Seletor de ownership OCULTO no frontend

SE member_count >= 2:
    ├─ ownership_type = "personal" (default)
    └─ Seletor de ownership VISÍVEL no frontend
```

#### Regra 2: Validação de Permissões na Criação
```
AO criar recurso:
    SE ownership_type = "household":
        ├─ Validar can_create_transactions = True
        ├─ Se False: retornar erro 403
        └─ Mensagem: "Você não tem permissão para criar recursos compartilhados"

    SE ownership_type = "personal":
        └─ Sempre permitido (sem validação)
```

#### Regra 3: Campos Obrigatórios
```
AO exibir formulário de criação:
    SE member_count >= 2:
        └─ Campo "Visibilidade" (Personal/Household) obrigatório
```

### 4.2 Edição de Recursos

#### Regra 4: Permissão para Editar
```
AO editar recurso:
    SE resource.user_id == current_user.id:
        └─ Sempre permitido (é o criador)

    SE resource.user_id != current_user.id:
        SE resource.ownership_type == "household":
            SE member.can_edit_shared == True:
                └─ Permitido
            SE member.can_edit_shared == False:
                └─ Erro 403: "Sem permissão para editar recursos compartilhados"

        SE resource.ownership_type == "personal":
            └─ Erro 403: "Você não pode editar recursos pessoais de outros membros"
```

#### Regra 5: Não Permitir Mudar Ownership Após Criação
```
AO editar recurso:
    SE tentando alterar ownership_type:
        └─ Erro 400: "Não é permitido alterar a visibilidade após criação"
```

**Exceção:** Apenas OWNER da licença pode mudar ownership.

### 4.3 Exclusão de Recursos

#### Regra 6: Permissão para Excluir
```
AO excluir recurso:
    SE resource.user_id == current_user.id:
        └─ Sempre permitido (é o criador)

    SE resource.user_id != current_user.id:
        SE current_user.role == "owner":
            └─ Permitido (owner pode excluir qualquer recurso household)
        SENÃO:
            └─ Erro 403: "Apenas o criador ou owner pode excluir este recurso"
```

### 4.4 Listagem de Recursos

#### Regra 7: Query Padrão de Listagem
```sql
SELECT * FROM resource
WHERE (
    -- Recursos PERSONAL do usuário atual
    (user_id = :current_user_id AND ownership_type = 'personal')
    OR
    -- Recursos HOUSEHOLD de qualquer membro da família
    (user_id IN :household_user_ids AND ownership_type = 'household')
)
```

#### Regra 8: can_see_all Override
```
SE member.can_see_all == True:
    └─ Query adiciona:
        OR (user_id IN :household_user_ids)

    Resultado: vê TODOS os recursos de TODOS os membros (incluindo personal)
```

### 4.5 Validações Específicas por Módulo

#### Orçamentos (Budgets)
```
- Budget household = soma gastos de TODOS os membros
- Budget personal = soma gastos apenas do criador
- Alertas de orçamento ultrapassado consideram ownership
```

#### Metas (Goals)
```
- Meta household = aceita contribuições de qualquer membro
- Meta personal = aceita contribuições apenas do criador
- Progresso de meta household = soma de todas as contribuições
```

#### Dívidas (Debts)
```
- Dívida household = aceita pagamentos de qualquer membro
- Plano Snowball/Avalanche considera ownership:
  - SE household: considera dívidas household de todos
  - SE personal: considera apenas dívidas personal do usuário
```

#### Transações Recorrentes
```
- Recorrente household = gera transações household
- Recorrente personal = gera transações personal
- Ao criar de fatura, herda ownership da conta associada
```

---

## 5. Plano de Implementação Completo

### 5.1 Fase 1: Infraestrutura e Helpers (Prioridade MÁXIMA)

#### Task 1.1: Criar Helper de Household
**Arquivo:** `backend/app/modules/household/utils/household_helpers.py`

```python
"""
Helpers para lógica de household reutilizáveis em todos os módulos
"""
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import HouseholdMember
from app.models.user import User


async def get_household_user_ids(db: AsyncSession, user: User) -> list[int]:
    """
    Retorna lista de user_ids de todos os membros da mesma household.
    Se usuário não tem license_id, retorna lista vazia.
    """
    if not user.license_id:
        return []

    result = await db.execute(
        select(HouseholdMember.user_id).where(
            HouseholdMember.license_id == user.license_id
        )
    )
    return list(result.scalars().all())


async def get_household_member(db: AsyncSession, user: User) -> HouseholdMember | None:
    """
    Retorna o HouseholdMember do usuário atual.
    """
    if not user.license_id:
        return None

    result = await db.execute(
        select(HouseholdMember).where(
            HouseholdMember.user_id == user.id,
            HouseholdMember.license_id == user.license_id
        )
    )
    return result.scalar_one_or_none()


def build_ownership_filter(model, user_id_field, ownership_field, current_user_id: int, household_user_ids: list[int]):
    """
    Constrói filtro SQLAlchemy padrão para ownership.

    Args:
        model: Classe do modelo SQLAlchemy
        user_id_field: Campo user_id do modelo (ex: Transaction.user_id)
        ownership_field: Campo ownership_type do modelo (ex: Transaction.ownership_type)
        current_user_id: ID do usuário atual
        household_user_ids: Lista de IDs da household

    Returns:
        Expressão SQLAlchemy para usar em .where()
    """
    if household_user_ids:
        return or_(
            # Recursos PERSONAL do usuário atual
            and_(
                user_id_field == current_user_id,
                ownership_field == "personal"
            ),
            # Recursos HOUSEHOLD de qualquer membro
            and_(
                user_id_field.in_(household_user_ids),
                ownership_field == "household"
            )
        )
    else:
        # Sem household, apenas recursos do próprio usuário
        return user_id_field == current_user_id


async def validate_create_permission(db: AsyncSession, user: User, ownership_type: str) -> None:
    """
    Valida se usuário tem permissão para criar recurso com ownership_type especificado.
    Levanta HTTPException 403 se não tiver permissão.
    """
    from fastapi import HTTPException, status

    if ownership_type == "personal":
        return  # Sempre permitido

    # household
    member = await get_household_member(db, user)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não está em uma família para criar recursos compartilhados"
        )

    if not member.can_create_transactions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para criar recursos compartilhados"
        )


async def validate_edit_permission(
    db: AsyncSession,
    user: User,
    resource_user_id: int,
    resource_ownership: str
) -> None:
    """
    Valida se usuário tem permissão para editar recurso.
    Levanta HTTPException 403 se não tiver permissão.
    """
    from fastapi import HTTPException, status

    # Criador sempre pode editar
    if resource_user_id == user.id:
        return

    # Recurso de outro usuário
    if resource_ownership == "personal":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não pode editar recursos pessoais de outros membros"
        )

    # household - verificar permissão
    member = await get_household_member(db, user)
    if not member or not member.can_edit_shared:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para editar recursos compartilhados"
        )


async def validate_delete_permission(
    db: AsyncSession,
    user: User,
    resource_user_id: int,
    resource_ownership: str
) -> None:
    """
    Valida se usuário tem permissão para excluir recurso.
    Levanta HTTPException 403 se não tiver permissão.
    """
    from fastapi import HTTPException, status

    # Criador sempre pode excluir
    if resource_user_id == user.id:
        return

    # Verificar se é owner da license
    member = await get_household_member(db, user)
    if member and member.role == "owner":
        return  # Owner pode excluir recursos household

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas o criador ou dono da família pode excluir este recurso"
    )
```

**Tempo estimado:** 2 horas
**Testes:** Criar testes unitários para cada função

---

#### Task 1.2: Criar Componente Reutilizável de Ownership Selector
**Arquivo:** `frontend/src/components/shared/OwnershipSelector.tsx`

```typescript
import { User, Users } from 'lucide-react'
import { clsx } from 'clsx'

interface OwnershipSelectorProps {
  value: 'personal' | 'household'
  onChange: (value: 'personal' | 'household') => void
  disabled?: boolean
  label?: string
  description?: string
}

export default function OwnershipSelector({
  value,
  onChange,
  disabled = false,
  label = 'Visibilidade',
  description
}: OwnershipSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('personal')}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
            value === 'personal'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <User size={20} className={value === 'personal' ? 'text-primary-600' : 'text-gray-400'} />
          <div className="text-left">
            <div className={clsx(
              'text-sm font-medium',
              value === 'personal' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'
            )}>
              Pessoal
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Só você vê</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange('household')}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
            value === 'household'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Users size={20} className={value === 'household' ? 'text-primary-600' : 'text-gray-400'} />
          <div className="text-left">
            <div className={clsx(
              'text-sm font-medium',
              value === 'household' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'
            )}>
              Familiar
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Família vê</div>
          </div>
        </button>
      </div>
    </div>
  )
}
```

**Tempo estimado:** 1 hora
**Testes:** Criar Storybook stories

---

### 5.2 Fase 2: Correção de Módulos Backend (Prioridade ALTA)

#### Task 2.1: Budgets - Implementar Household
**Arquivos a modificar:**
1. `backend/app/modules/budgets/services/budget_service.py`
2. `backend/app/modules/budgets/routers/budgets.py`

**Mudanças:**

```python
# budget_service.py

from app.modules.household.utils.household_helpers import (
    get_household_user_ids,
    build_ownership_filter,
    validate_create_permission,
    validate_edit_permission
)

class BudgetService:
    async def list_budgets(self, user: User, ...) -> list[Budget]:
        household_user_ids = await get_household_user_ids(self.db, user)

        query = select(Budget).where(
            build_ownership_filter(
                Budget,
                Budget.user_id,
                Budget.ownership_type,
                user.id,
                household_user_ids
            )
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_budget(self, user: User, data: BudgetCreate) -> Budget:
        # Validar permissão
        await validate_create_permission(self.db, user, data.ownership_type.value)

        budget = Budget(
            user_id=user.id,
            ownership_type=data.ownership_type.value,
            ...
        )
        # ...

    async def _get_expenses_by_category(self, user: User, start_date, end_date):
        """
        CRÍTICO: Deve considerar transações household ao calcular gastos
        """
        household_user_ids = await get_household_user_ids(self.db, user)

        query = select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.type == TransactionType.EXPENSE,
            build_ownership_filter(
                Transaction,
                Transaction.user_id,
                Transaction.ownership_type,
                user.id,
                household_user_ids
            )
        )
        # ...
```

**Validações necessárias:**
- [ ] Budget.ownership_type existe no modelo
- [ ] BudgetCreate schema tem campo ownership_type
- [ ] Endpoint GET /budgets filtra household
- [ ] Endpoint POST /budgets valida permissão
- [ ] Endpoint PATCH /budgets valida permissão de edição
- [ ] _get_expenses_by_category considera transações household

**Tempo estimado:** 4 horas
**Testes:**
- Criar budget personal
- Criar budget household
- Listar budgets de família
- Validar cálculo de gastos inclui transações household

---

#### Task 2.2: Goals - Implementar Household
**Arquivos a modificar:**
1. `backend/app/modules/goals/services/goal_service.py`
2. `backend/app/modules/goals/routers/goals.py`

**Mudanças similares a Budgets:**

```python
# goal_service.py

async def list_goals(self, user: User, status_filter: GoalStatus | None = None) -> list[GoalResponse]:
    household_user_ids = await get_household_user_ids(self.db, user)

    query = select(Goal).where(
        build_ownership_filter(
            Goal,
            Goal.user_id,
            Goal.ownership_type,
            user.id,
            household_user_ids
        )
    )

    if status_filter:
        query = query.where(Goal.status == status_filter.value)

    result = await self.db.execute(query)
    return [await self._build_goal_response(goal) for goal in result.scalars().all()]

async def create_goal(self, user: User, data: GoalCreate) -> Goal:
    await validate_create_permission(self.db, user, data.ownership_type.value)
    # ...
```

**Validações necessárias:**
- [ ] Goal.ownership_type existe no modelo
- [ ] GoalCreate schema tem campo ownership_type
- [ ] Endpoint GET /goals filtra household
- [ ] Endpoint POST /goals valida permissão
- [ ] GoalContribution aceita contribuições de qualquer membro em goal household
- [ ] Progresso de goal household soma contribuições de todos

**Tempo estimado:** 4 horas
**Testes:**
- Criar goal personal/household
- Adicionar contribuição de outro membro em goal household
- Verificar que progresso soma corretamente

---

#### Task 2.3: Debts - Implementar Household
**Arquivos a modificar:**
1. `backend/app/modules/debts/services/debt_service.py`
2. `backend/app/modules/debts/routers/debts.py`

**Mudanças:**

```python
# debt_service.py

async def list_debts(self, user: User, status_filter: DebtStatus | None = None) -> list[DebtResponse]:
    household_user_ids = await get_household_user_ids(self.db, user)

    query = select(Debt).where(
        build_ownership_filter(
            Debt,
            Debt.user_id,
            Debt.ownership_type,
            user.id,
            household_user_ids
        )
    )
    # ...

async def get_snowball_plan(self, user: User, monthly_payment: Decimal) -> SnowballPlan:
    """
    CRÍTICO: Plano Snowball deve considerar TODAS as dívidas visíveis
    (personal do usuário + household da família)
    """
    household_user_ids = await get_household_user_ids(self.db, user)

    query = select(Debt).where(
        Debt.status == DebtStatus.ACTIVE.value,
        build_ownership_filter(
            Debt,
            Debt.user_id,
            Debt.ownership_type,
            user.id,
            household_user_ids
        )
    ).order_by(Debt.current_balance.asc())  # Menor saldo primeiro

    # ...
```

**Validações necessárias:**
- [ ] Debt.ownership_type existe no modelo
- [ ] DebtCreate schema tem campo ownership_type
- [ ] Endpoint GET /debts filtra household
- [ ] Endpoint POST /debts valida permissão
- [ ] Snowball/Avalanche considera dívidas household
- [ ] DebtPayment aceita pagamentos de qualquer membro em debt household

**Tempo estimado:** 4 horas
**Testes:**
- Criar debt personal/household
- Adicionar payment de outro membro em debt household
- Verificar Snowball inclui dívidas household

---

#### Task 2.4: Recurring Transactions - Implementar Household
**Arquivos a modificar:**
1. `backend/app/modules/recurring/services/recurring_service.py`
2. `backend/app/modules/recurring/routers/recurring.py`
3. `backend/app/modules/recurring/schemas/recurring.py`

**Mudanças:**

```python
# recurring_service.py

async def list(self, user: User, include_inactive: bool = False) -> list[RecurringResponse]:
    household_user_ids = await get_household_user_ids(self.db, user)

    query = select(RecurringTransaction).where(
        build_ownership_filter(
            RecurringTransaction,
            RecurringTransaction.user_id,
            RecurringTransaction.ownership_type,
            user.id,
            household_user_ids
        )
    )

    if not include_inactive:
        query = query.where(RecurringTransaction.status != RecurringStatus.CANCELLED.value)

    result = await self.db.execute(query)
    # ...

# CRÍTICO: Ao gerar transação de recorrente household, criar transaction household
async def generate_pending_transactions(self, user: User) -> list[Transaction]:
    # ...
    transaction = Transaction(
        user_id=recurring.user_id,  # Mantém criador original
        ownership_type=recurring.ownership_type,  # ← Herda do recorrente
        # ...
    )
```

**Adicionar campo em RecurringFromSuggestionCreate:**

```python
# recurring.py (schemas)

class RecurringFromSuggestionCreate(BaseModel):
    name: str
    amount: Decimal
    account_id: int
    frequency: RecurrenceFrequency
    day_of_month: int | None = None
    ownership_type: OwnershipType = OwnershipType.PERSONAL  # ← ADICIONAR
    # ...
```

**Validações necessárias:**
- [ ] RecurringTransaction.ownership_type existe no modelo
- [ ] RecurringCreate schema tem campo ownership_type
- [ ] RecurringFromSuggestionCreate tem campo ownership_type
- [ ] Endpoint GET /recurring filtra household
- [ ] Endpoint POST /recurring valida permissão
- [ ] Transações geradas herdam ownership do recorrente
- [ ] Criação de sugestão passa ownership_type

**Tempo estimado:** 5 horas
**Testes:**
- Criar recurring personal/household
- Gerar transações e verificar ownership correto
- Criar recurring de sugestão com ownership household

---

#### Task 2.5: Credit Cards e Accounts - Remover Hardcode
**Arquivos a modificar:**
1. `backend/app/modules/credit_cards/routers/credit_cards.py`
2. `backend/app/modules/accounts/routers/accounts.py`

**Mudanças:**

```python
# credit_cards.py

@router.post("", response_model=CreditCardResponse, status_code=201)
async def create_credit_card(
    data: CreditCardCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    # Validar permissão se household
    await validate_create_permission(db, current_user, data.ownership_type.value)

    # Create the linked account
    account = Account(
        user_id=current_user.id,
        name=data.name,
        type=AccountType.CREDIT_CARD.value,
        balance=data.initial_balance,
        currency="BRL",
        color=data.color,
        icon=data.icon,
        ownership_type=data.ownership_type.value,  # ← Usar do data, não hardcode
    )
    # ...
```

**Adicionar ownership_type em CreditCardCreate:**

```python
# credit_card.py (schemas)

class CreditCardCreate(BaseModel):
    name: str
    credit_limit: Decimal
    ownership_type: OwnershipType = OwnershipType.PERSONAL  # ← ADICIONAR
    # ... demais campos
```

**Validações necessárias:**
- [ ] CreditCardCreate tem ownership_type
- [ ] Account criada usa ownership_type do data
- [ ] POST /credit-cards valida permissão
- [ ] POST /accounts valida permissão

**Tempo estimado:** 2 horas
**Testes:**
- Criar account household
- Criar credit card household
- Verificar account vinculada tem ownership correto

---

### 5.3 Fase 3: Correção de Frontend (Prioridade ALTA)

#### Task 3.1: Upload PDF - Adicionar Ownership Selector
**Arquivos a modificar:**
1. `frontend/src/components/upload/ExtractedItemsList.tsx`
2. `frontend/src/pages/Upload.tsx`
3. `frontend/src/types/upload.ts`

**Mudanças:**

**1. Adicionar campo no tipo:**
```typescript
// types/upload.ts

export interface ExtractedItem {
  // ... campos existentes
  ownership_type?: 'personal' | 'household'  // ← ADICIONAR
}
```

**2. Adicionar estado global de ownership:**
```typescript
// pages/Upload.tsx

const [batchOwnershipType, setBatchOwnershipType] = useState<'personal' | 'household'>('personal')
```

**3. Adicionar seletor antes da lista de itens:**
```typescript
// pages/Upload.tsx

{!isManual && document?.extracted_items && (
  <>
    {/* Ownership selector for all items */}
    {showOwnershipSelector && (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-4">
        <OwnershipSelector
          value={batchOwnershipType}
          onChange={setBatchOwnershipType}
          label="Visibilidade de todas as transações"
          description="Escolha se estas transações são pessoais ou compartilhadas com a família"
        />
      </div>
    )}

    <ExtractedItemsList
      items={document.extracted_items}
      // ... demais props
    />
  </>
)}
```

**4. Usar ao confirmar transações:**
```typescript
// pages/Upload.tsx - handleBatchAdd

const handleBatchAdd = async () => {
  // ...
  for (const index of selectedItems) {
    confirmMutation.mutate({
      // ... demais campos
      ownership_type: batchOwnershipType,  // ← Usar valor global
    })
  }
}
```

**Validações necessárias:**
- [ ] Seletor aparece apenas se member_count >= 2
- [ ] Default é "personal"
- [ ] Todas transações confirmadas usam ownership escolhido
- [ ] Visual indica claramente qual ownership está selecionado

**Tempo estimado:** 3 horas
**Testes:**
- Upload PDF com família, verificar seletor aparece
- Confirmar itens como household, verificar criação correta
- Upload PDF sem família, verificar seletor não aparece

---

#### Task 3.2: Budgets - Adicionar Ownership UI
**Arquivos a modificar/criar:**
1. `frontend/src/pages/Budgets.tsx` (se existir)
2. Criar componente de formulário de budget

**Mudanças:**

```typescript
// Exemplo de formulário de budget

import OwnershipSelector from '../components/shared/OwnershipSelector'

const [budgetForm, setBudgetForm] = useState({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  ownership_type: 'personal' as 'personal' | 'household',
  // ...
})

return (
  <form>
    {/* ... demais campos */}

    {showOwnershipSelector && (
      <OwnershipSelector
        value={budgetForm.ownership_type}
        onChange={(val) => setBudgetForm(prev => ({ ...prev, ownership_type: val }))}
        description="Orçamento familiar é compartilhado e soma gastos de todos os membros"
      />
    )}

    <button type="submit">Criar Orçamento</button>
  </form>
)
```

**Validações necessárias:**
- [ ] Formulário de criação tem ownership selector
- [ ] Listagem mostra badge de ownership
- [ ] Filtro permite ver apenas personal ou household

**Tempo estimado:** 3 horas
**Testes:**
- Criar budget household
- Verificar que gastos de família são incluídos

---

#### Task 3.3: Goals - Adicionar Ownership UI
**Similar a Budgets**

**Tempo estimado:** 3 horas

---

#### Task 3.4: Debts - Adicionar Ownership UI
**Similar a Budgets**

**Tempo estimado:** 3 horas

---

#### Task 3.5: Recurring - Adicionar Ownership UI
**Similar a Budgets**

**Tempo estimado:** 3 horas

---

#### Task 3.6: Credit Cards - Adicionar Ownership UI
**Arquivos a modificar:**
1. `frontend/src/pages/CreditCards.tsx` (se existir)
2. Formulário de criação de cartão

**Mudanças:**

```typescript
const [cardForm, setCardForm] = useState({
  name: '',
  credit_limit: '',
  ownership_type: 'personal' as 'personal' | 'household',
  // ...
})

{showOwnershipSelector && (
  <OwnershipSelector
    value={cardForm.ownership_type}
    onChange={(val) => setCardForm(prev => ({ ...prev, ownership_type: val }))}
    description="Cartão familiar é compartilhado com todos os membros da família"
  />
)}
```

**Validações necessárias:**
- [ ] Formulário tem ownership selector
- [ ] Account criada automaticamente usa mesmo ownership
- [ ] Listagem mostra badge de ownership

**Tempo estimado:** 2 horas

---

### 5.4 Fase 4: Validações e Permissões (Prioridade MÉDIA)

#### Task 4.1: Implementar Validações nos Endpoints
**Aplicar em TODOS os endpoints de create/update/delete**

**Exemplo para Transactions:**

```python
# transactions.py (router)

@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    # Validar permissão
    await validate_create_permission(db, current_user, data.ownership_type.value)

    service = TransactionService(db)
    return await service.create(current_user, data)


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    service = TransactionService(db)

    # Buscar transação original
    transaction = await service.get_by_id(current_user, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    # Validar permissão
    await validate_edit_permission(
        db,
        current_user,
        transaction.user_id,
        transaction.ownership_type
    )

    return await service.update(current_user, transaction_id, data)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    service = TransactionService(db)

    transaction = await service.get_by_id(current_user, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    # Validar permissão
    await validate_delete_permission(
        db,
        current_user,
        transaction.user_id,
        transaction.ownership_type
    )

    await service.delete(current_user, transaction_id)
```

**Aplicar padrão acima em:**
- [ ] Transactions
- [ ] Accounts
- [ ] Income Sources
- [ ] Budgets
- [ ] Goals
- [ ] Debts
- [ ] Recurring
- [ ] Credit Cards

**Tempo estimado:** 6 horas
**Testes:**
- Tentar criar household sem permissão (expect 403)
- Tentar editar household de outro sem can_edit_shared (expect 403)
- Tentar excluir personal de outro (expect 403)
- Owner consegue excluir household de qualquer membro

---

#### Task 4.2: Implementar can_see_all
**Modificar household_helpers.py**

```python
def build_ownership_filter(
    model,
    user_id_field,
    ownership_field,
    current_user_id: int,
    household_user_ids: list[int],
    member: HouseholdMember | None = None  # ← ADICIONAR
):
    """
    Se member.can_see_all == True, vê TODOS os recursos de TODOS os membros
    """
    if member and member.can_see_all:
        # Vê tudo da household
        return user_id_field.in_(household_user_ids)

    # Lógica padrão
    if household_user_ids:
        return or_(
            and_(user_id_field == current_user_id, ownership_field == "personal"),
            and_(user_id_field.in_(household_user_ids), ownership_field == "household")
        )
    else:
        return user_id_field == current_user_id
```

**Modificar todos os services para passar member:**

```python
# Exemplo: transaction_service.py

async def list(self, user: User, ...) -> list[Transaction]:
    household_user_ids = await get_household_user_ids(self.db, user)
    member = await get_household_member(self.db, user)  # ← Buscar member

    query = select(Transaction).where(
        build_ownership_filter(
            Transaction,
            Transaction.user_id,
            Transaction.ownership_type,
            user.id,
            household_user_ids,
            member  # ← Passar para helper
        )
    )
    # ...
```

**Aplicar em todos os services de listagem**

**Tempo estimado:** 4 horas
**Testes:**
- Setar can_see_all=True para um membro
- Verificar que vê transações personal de outros
- Verificar que vê TODOS os recursos

---

### 5.5 Fase 5: Melhorias de UX (Prioridade BAIXA)

#### Task 5.1: Badges e Indicadores Visuais
**Adicionar badge mostrando ownership em listagens**

```typescript
// Exemplo: TransactionListItem.tsx

interface TransactionListItemProps {
  transaction: Transaction
  currentUserId: number
}

export default function TransactionListItem({ transaction, currentUserId }: TransactionListItemProps) {
  const isHousehold = transaction.ownership_type === 'household'
  const isCreator = transaction.user_id === currentUserId

  return (
    <div className="transaction-item">
      {/* ... conteúdo da transação */}

      <div className="flex items-center gap-2">
        {isHousehold && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            <Users size={12} />
            Familiar
          </span>
        )}

        {isHousehold && !isCreator && (
          <span className="text-xs text-gray-500">
            por {transaction.user_name || 'outro membro'}
          </span>
        )}
      </div>
    </div>
  )
}
```

**Aplicar em:**
- [ ] Transaction list
- [ ] Account list
- [ ] Budget list
- [ ] Goal list
- [ ] Debt list
- [ ] Recurring list

**Tempo estimado:** 4 horas

---

#### Task 5.2: Tooltip/Info sobre Ownership
**Adicionar info tooltip explicando ownership**

```typescript
import { Info } from 'lucide-react'

<div className="flex items-center gap-2">
  <label>Visibilidade</label>
  <button
    type="button"
    className="text-gray-400 hover:text-gray-600"
    title="Personal: apenas você vê este recurso. Familiar: todos os membros da família veem e podem interagir (dependendo das permissões)"
  >
    <Info size={16} />
  </button>
</div>
```

**Tempo estimado:** 1 hora

---

#### Task 5.3: Filtros de Ownership em Listagens
**Adicionar filtro para mostrar apenas personal ou household**

```typescript
const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'personal' | 'household'>('all')

const filteredTransactions = transactions.filter(t => {
  if (ownershipFilter === 'all') return true
  return t.ownership_type === ownershipFilter
})
```

**Tempo estimado:** 2 horas

---

### 5.6 Fase 6: Auditoria e Notificações (Prioridade FUTURA)

#### Task 6.1: Adicionar Audit Log
**Criar modelo de auditoria**

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    license_id: Mapped[int]
    user_id: Mapped[int]
    action: Mapped[str]  # "create", "update", "delete"
    resource_type: Mapped[str]  # "transaction", "budget", etc
    resource_id: Mapped[int]
    resource_ownership: Mapped[str]
    changes: Mapped[dict]  # JSON com mudanças
    timestamp: Mapped[datetime] = mapped_column(default=func.now())
```

**Tempo estimado:** 8 horas (baixa prioridade)

---

#### Task 6.2: Sistema de Notificações
**Criar notificações para ações em recursos household**

Exemplos:
- "João adicionou uma despesa de R$ 500 em Supermercado"
- "Maria criou uma meta familiar: Viagem para Disney"
- "Pedro ultrapassou o orçamento de Alimentação"

**Tempo estimado:** 16 horas (baixa prioridade)

---

## 6. Validações por Módulo

### 6.1 Checklist de Validação Backend

Para CADA módulo, validar:

#### Modelo (Model)
- [ ] Campo `ownership_type: Mapped[str]` existe
- [ ] Default é `"personal"`
- [ ] Não é nullable

#### Schema
- [ ] `XXXCreate` tem campo `ownership_type: OwnershipType = OwnershipType.PERSONAL`
- [ ] `XXXResponse` tem campo `ownership_type: str`
- [ ] `XXXUpdate` NÃO tem campo ownership_type (não permite mudar após criação)

#### Service - List
- [ ] Importa `get_household_user_ids` e `build_ownership_filter`
- [ ] Busca household_user_ids
- [ ] Usa `build_ownership_filter` na query
- [ ] Retorna recursos personal do usuário + household da família

#### Service - Create
- [ ] Valida permissão com `validate_create_permission`
- [ ] Atribui `user_id = current_user.id`
- [ ] Atribui `ownership_type = data.ownership_type.value`

#### Service - Update
- [ ] Busca recurso original
- [ ] Valida permissão com `validate_edit_permission`
- [ ] NÃO permite alterar ownership_type

#### Service - Delete
- [ ] Busca recurso original
- [ ] Valida permissão com `validate_delete_permission`

#### Router
- [ ] Todos endpoints de list usam service.list() que filtra household
- [ ] Todos endpoints de create validam permissão
- [ ] Todos endpoints de update validam permissão
- [ ] Todos endpoints de delete validam permissão

---

### 6.2 Checklist de Validação Frontend

Para CADA módulo, validar:

#### Listagem
- [ ] Mostra badge de ownership (Personal/Familiar)
- [ ] Se household + não é criador, mostra "por [nome]"
- [ ] Filtro de ownership funciona

#### Formulário de Criação
- [ ] Importa `OwnershipSelector` component
- [ ] Busca `familyData` para determinar `showOwnershipSelector`
- [ ] Mostra seletor apenas se `member_count >= 2`
- [ ] Default é "personal"
- [ ] Envia `ownership_type` correto na API

#### Formulário de Edição
- [ ] NÃO mostra seletor de ownership (não pode mudar)
- [ ] Mostra ownership atual de forma read-only

#### Detalhes
- [ ] Mostra claramente se é Personal ou Familiar
- [ ] Se household, mostra quem criou

---

### 6.3 Matriz de Validação Completa

| Módulo | Backend List | Backend Create | Backend Update | Backend Delete | Frontend List | Frontend Create | Frontend Edit |
|--------|--------------|----------------|----------------|----------------|---------------|-----------------|---------------|
| Transactions | ✅ OK | ✅ OK | ⚠️ Sem validação | ⚠️ Sem validação | ✅ OK | ✅ OK | ⚠️ Sem indicador |
| Accounts | ✅ OK | ⚠️ Hardcoded | ⚠️ Sem validação | ⚠️ Sem validação | ✅ OK | ✅ OK | ⚠️ Sem indicador |
| Income Sources | ✅ OK | ⚠️ Sem validação | ⚠️ Sem validação | ⚠️ Sem validação | ✅ OK | ✅ OK | ⚠️ Sem indicador |
| Budgets | ❌ Não filtra | ❌ Não valida | ❌ Não valida | ❌ Não valida | ❌ Sem UI | ❌ Sem UI | ❌ Sem UI |
| Goals | ❌ Não filtra | ❌ Não valida | ❌ Não valida | ❌ Não valida | ❌ Sem UI | ❌ Sem UI | ❌ Sem UI |
| Debts | ❌ Não filtra | ❌ Não valida | ❌ Não valida | ❌ Não valida | ❌ Sem UI | ❌ Sem UI | ❌ Sem UI |
| Recurring | ❌ Não filtra | ❌ Não valida | ❌ Não valida | ❌ Não valida | ❌ Sem UI | ❌ Sem UI | ❌ Sem UI |
| Credit Cards | ✅ OK (via Account) | ⚠️ Hardcoded | ⚠️ Sem validação | ⚠️ Sem validação | ⚠️ Sem badge | ⚠️ Hardcoded | ⚠️ Sem indicador |
| Upload PDF | N/A | N/A | N/A | N/A | N/A | ❌ Sem seletor | N/A |

**Legenda:**
- ✅ OK = Implementado corretamente
- ⚠️ = Implementado parcialmente
- ❌ = Não implementado

---

## 7. Casos de Uso e Cenários

### 7.1 Cenário 1: Família Silva - Orçamento Familiar

**Contexto:**
- João (Owner)
- Maria (Admin, can_edit_shared=True)
- Pedro (Member, can_edit_shared=False)

**Fluxo:**

1. **João cria orçamento familiar**
   ```
   POST /budgets
   {
     "year": 2026,
     "month": 1,
     "ownership_type": "household",
     "items": [
       { "category_id": 1, "planned_amount": 2000 }  // Alimentação
     ]
   }
   ```
   - ✅ João tem can_create_transactions=True
   - ✅ Budget criado com ownership="household"
   - ✅ Maria e Pedro veem o orçamento

2. **Maria adiciona despesa de mercado (R$ 500)**
   ```
   POST /transactions
   {
     "amount": 500,
     "ownership_type": "household",
     "category_id": 1  // Alimentação
   }
   ```
   - ✅ Despesa é household
   - ✅ Todos veem a despesa
   - ✅ Orçamento de Alimentação mostra R$ 500 / R$ 2000

3. **Pedro adiciona despesa de mercado (R$ 300)**
   - ✅ Orçamento agora mostra R$ 800 / R$ 2000 (500 + 300)

4. **Maria edita o orçamento (aumenta para R$ 2500)**
   ```
   PATCH /budgets/{id}
   {
     "items": [
       { "category_id": 1, "planned_amount": 2500 }
     ]
   }
   ```
   - ✅ Maria tem can_edit_shared=True
   - ✅ Edição permitida

5. **Pedro tenta editar o orçamento**
   - ❌ Erro 403: "Você não tem permissão para editar recursos compartilhados"
   - ✅ Pedro tem can_edit_shared=False

**Resultado esperado:**
- Orçamento familiar unificado
- Todos contribuem com despesas
- Apenas João e Maria podem editar
- Visão consolidada do gasto familiar

---

### 7.2 Cenário 2: Família Costa - Meta de Viagem

**Contexto:**
- Ana (Owner)
- Carlos (Member)
- Júlia (Member)

**Fluxo:**

1. **Ana cria meta familiar: "Viagem para Disney"**
   ```
   POST /goals
   {
     "name": "Viagem para Disney",
     "target_amount": 30000,
     "ownership_type": "household",
     "target_date": "2026-12-01"
   }
   ```
   - ✅ Meta criada como household
   - ✅ Carlos e Júlia veem a meta

2. **Ana contribui R$ 5.000**
   ```
   POST /goals/{id}/contributions
   {
     "amount": 5000
   }
   ```
   - ✅ Meta: R$ 5.000 / R$ 30.000 (17%)

3. **Carlos contribui R$ 3.000**
   - ✅ Meta: R$ 8.000 / R$ 30.000 (27%)

4. **Júlia contribui R$ 2.000**
   - ✅ Meta: R$ 10.000 / R$ 30.000 (33%)

5. **Ana visualiza contribuições**
   - ✅ Vê lista de contribuições:
     - Ana: R$ 5.000
     - Carlos: R$ 3.000
     - Júlia: R$ 2.000
   - ✅ Total: R$ 10.000

**Resultado esperado:**
- Meta familiar colaborativa
- Todos podem contribuir
- Progresso consolidado
- Motivação familiar

---

### 7.3 Cenário 3: Família Oliveira - Dívida Compartilhada

**Contexto:**
- Roberto (Owner)
- Fernanda (Member)

**Fluxo:**

1. **Roberto cadastra financiamento imobiliário**
   ```
   POST /debts
   {
     "name": "Financiamento Imóvel",
     "type": "mortgage",
     "original_amount": 500000,
     "current_balance": 450000,
     "ownership_type": "household",
     "minimum_payment": 3000,
     "interest_rate": 0.8
   }
   ```
   - ✅ Dívida criada como household
   - ✅ Fernanda vê a dívida

2. **Fernanda faz pagamento de R$ 3.500**
   ```
   POST /debts/{id}/payments
   {
     "amount": 3500,
     "principal_amount": 2800,
     "interest_amount": 700
   }
   ```
   - ✅ Dívida atualizada: R$ 447.200
   - ✅ Roberto vê o pagamento de Fernanda

3. **Roberto consulta plano Snowball**
   ```
   GET /debts/snowball?monthly_payment=5000
   ```
   - ✅ Plano inclui a dívida household
   - ✅ Projeção considera pagamento mensal de R$ 5.000

**Resultado esperado:**
- Dívida compartilhada
- Ambos podem pagar
- Ambos veem progresso
- Planejamento conjunto

---

### 7.4 Cenário 4: Família Santos - Upload de Fatura Compartilhada

**Contexto:**
- Lucas (Owner)
- Mariana (Member)

**Fluxo:**

1. **Lucas faz upload de conta de luz (R$ 250)**
   - Upload: `/upload`
   - Documento processado
   - Item extraído: "COPEL - R$ 250"

2. **Lucas seleciona ownership = "Familiar"**
   - ✅ Seletor aparece (member_count = 2)
   - ✅ Lucas escolhe "Familiar"

3. **Lucas confirma transação**
   ```
   POST /transactions/confirm
   {
     "amount": 250,
     "description": "Conta de luz",
     "ownership_type": "household"
   }
   ```
   - ✅ Transação criada como household
   - ✅ Mariana vê a despesa

4. **Mariana visualiza no dashboard**
   - ✅ Vê "Conta de luz - R$ 250"
   - ✅ Badge "Familiar"
   - ✅ "por Lucas"

**Resultado esperado:**
- Upload de fatura compartilhada
- Ambos veem a despesa
- Sem duplicação
- Clareza sobre quem lançou

---

### 7.5 Cenário 5: Família Almeida - Assinatura Recorrente

**Contexto:**
- Paula (Owner)
- Ricardo (Member)

**Fluxo:**

1. **Paula cria recorrente: "Netflix Familiar"**
   ```
   POST /recurring
   {
     "name": "Netflix",
     "amount": 55.90,
     "ownership_type": "household",
     "frequency": "monthly",
     "day_of_month": 15,
     "account_id": 1
   }
   ```
   - ✅ Recorrente criada como household
   - ✅ Ricardo vê a recorrente

2. **Sistema gera transação automática dia 15**
   - ✅ Transação criada:
     ```
     {
       "amount": 55.90,
       "description": "Netflix",
       "ownership_type": "household",  ← Herda do recorrente
       "user_id": paula.id,
       "date": "2026-01-15"
     }
     ```
   - ✅ Ricardo vê a transação
   - ✅ Ambos sabem que Netflix foi cobrado

3. **Ricardo tenta editar recorrente**
   - ⚠️ Depende de can_edit_shared
   - Se True: ✅ Pode editar (ex: aumentou pra plano Premium)
   - Se False: ❌ Erro 403

**Resultado esperado:**
- Recorrente familiar visível
- Transações geradas são household
- Todos sabem dos gastos fixos
- Controle sobre quem pode editar

---

## 8. Testes Necessários

### 8.1 Testes Unitários Backend

#### Test: household_helpers.py

```python
# tests/unit/test_household_helpers.py

import pytest
from app.modules.household.utils.household_helpers import (
    get_household_user_ids,
    build_ownership_filter,
    validate_create_permission,
    validate_edit_permission,
    validate_delete_permission
)

class TestHouseholdHelpers:

    async def test_get_household_user_ids_sem_license(self, db, user_sem_license):
        """User sem license_id retorna lista vazia"""
        result = await get_household_user_ids(db, user_sem_license)
        assert result == []

    async def test_get_household_user_ids_com_license(self, db, license, users_familia):
        """User com license retorna todos os IDs da família"""
        user1, user2, user3 = users_familia
        result = await get_household_user_ids(db, user1)
        assert sorted(result) == sorted([user1.id, user2.id, user3.id])

    async def test_build_ownership_filter_sem_household(self):
        """Sem household, filtra apenas user_id"""
        from app.models.transaction import Transaction

        filter_expr = build_ownership_filter(
            Transaction,
            Transaction.user_id,
            Transaction.ownership_type,
            current_user_id=1,
            household_user_ids=[]
        )
        # Assert que gerou: Transaction.user_id == 1

    async def test_build_ownership_filter_com_household(self):
        """Com household, filtra personal + household"""
        from app.models.transaction import Transaction

        filter_expr = build_ownership_filter(
            Transaction,
            Transaction.user_id,
            Transaction.ownership_type,
            current_user_id=1,
            household_user_ids=[1, 2, 3]
        )
        # Assert que gerou OR com AND corretos

    async def test_validate_create_permission_personal_sempre_ok(self, db, user):
        """Personal sempre permite criar"""
        await validate_create_permission(db, user, "personal")
        # Não deve lançar exceção

    async def test_validate_create_permission_household_sem_permissao(self, db, member_sem_permissao):
        """Household sem can_create_transactions lança 403"""
        with pytest.raises(HTTPException) as exc:
            await validate_create_permission(db, member_sem_permissao, "household")
        assert exc.value.status_code == 403

    async def test_validate_edit_permission_criador_sempre_ok(self, db, user):
        """Criador sempre pode editar"""
        await validate_edit_permission(db, user, resource_user_id=user.id, resource_ownership="household")
        # Não deve lançar exceção

    async def test_validate_edit_permission_personal_outro_fail(self, db, user1, user2):
        """Não pode editar personal de outro"""
        with pytest.raises(HTTPException) as exc:
            await validate_edit_permission(db, user1, resource_user_id=user2.id, resource_ownership="personal")
        assert exc.value.status_code == 403

    async def test_validate_edit_permission_household_com_can_edit(self, db, member_com_can_edit, user2):
        """Household com can_edit_shared=True pode editar"""
        await validate_edit_permission(db, member_com_can_edit, resource_user_id=user2.id, resource_ownership="household")
        # Não deve lançar exceção
```

**Total de testes unitários:** ~30 testes

---

#### Test: Services com Household

```python
# tests/unit/services/test_transaction_service.py

class TestTransactionService:

    async def test_list_sem_household_ve_apenas_proprias(self, db, user, transactions):
        """User sem household vê apenas suas transações"""
        service = TransactionService(db)
        result = await service.list(user)

        assert len(result) == 5  # 5 transações do user
        assert all(t.user_id == user.id for t in result)

    async def test_list_com_household_ve_personal_e_household(self, db, users_familia, transactions):
        """User com household vê personal próprias + household de todos"""
        user1, user2, user3 = users_familia
        service = TransactionService(db)
        result = await service.list(user1)

        # Deve ver:
        # - 3 personal do user1
        # - 2 household do user1
        # - 2 household do user2
        # - 1 household do user3
        assert len(result) == 8

    async def test_create_household_sem_permissao_fail(self, db, member_sem_permissao):
        """Criar household sem can_create_transactions lança 403"""
        service = TransactionService(db)
        data = TransactionCreate(
            amount=100,
            ownership_type=OwnershipType.HOUSEHOLD,
            # ...
        )

        with pytest.raises(HTTPException) as exc:
            await service.create(member_sem_permissao, data)
        assert exc.value.status_code == 403
```

**Aplicar testes similares para:**
- BudgetService
- GoalService
- DebtService
- RecurringService
- AccountService

**Total de testes de services:** ~50 testes

---

### 8.2 Testes de Integração Backend

```python
# tests/integration/test_budgets_household.py

class TestBudgetsHousehold:

    async def test_budget_household_soma_gastos_de_todos(self, client, license, users_familia):
        """Budget household soma gastos de TODOS os membros"""
        user1, user2, user3 = users_familia

        # User1 cria budget household
        response = await client.post("/budgets", json={
            "year": 2026,
            "month": 1,
            "ownership_type": "household",
            "items": [
                {"category_id": 1, "planned_amount": 1000}
            ]
        }, headers={"Authorization": f"Bearer {user1.token}"})
        assert response.status_code == 201

        # User1 adiciona gasto de 300
        await client.post("/transactions", json={
            "amount": 300,
            "ownership_type": "household",
            "category_id": 1,
            # ...
        }, headers={"Authorization": f"Bearer {user1.token}"})

        # User2 adiciona gasto de 400
        await client.post("/transactions", json={
            "amount": 400,
            "ownership_type": "household",
            "category_id": 1,
            # ...
        }, headers={"Authorization": f"Bearer {user2.token}"})

        # Buscar budget
        response = await client.get("/budgets?year=2026&month=1",
            headers={"Authorization": f"Bearer {user1.token}"})
        budget = response.json()

        # Verificar que soma 700 (300 + 400)
        assert budget["items"][0]["spent_amount"] == 700
        assert budget["items"][0]["available_amount"] == 300  # 1000 - 700
```

**Total de testes de integração:** ~40 testes

---

### 8.3 Testes E2E Frontend

```typescript
// tests/e2e/upload-pdf-household.spec.ts

describe('Upload PDF com Household', () => {

  it('mostra seletor de ownership quando família tem 2+ membros', async () => {
    // Login como membro de família
    await login('user1@example.com')

    // Ir para página de upload
    await page.goto('/upload')

    // Upload de PDF
    await page.setInputFiles('input[type=file]', 'fatura.pdf')

    // Aguardar processamento
    await page.waitForSelector('.extracted-items')

    // Verificar que seletor de ownership aparece
    const ownershipSelector = await page.locator('text=Visibilidade')
    await expect(ownershipSelector).toBeVisible()
  })

  it('confirma transações como household', async () => {
    // ... upload e processamento

    // Selecionar "Familiar"
    await page.click('text=Familiar')

    // Selecionar todos itens
    await page.click('text=Selecionar Todos')

    // Confirmar
    await page.click('text=Confirmar')

    // Aguardar sucesso
    await page.waitForSelector('text=Transações confirmadas')

    // Ir para listagem
    await page.goto('/transactions')

    // Verificar badge "Familiar"
    const badge = await page.locator('text=Familiar')
    await expect(badge).toBeVisible()
  })

  it('outro membro vê transações household', async () => {
    // ... user1 criou transações household

    // Logout e login como user2
    await logout()
    await login('user2@example.com')

    // Ir para transações
    await page.goto('/transactions')

    // Verificar que vê transações
    const transaction = await page.locator('text=Conta de luz')
    await expect(transaction).toBeVisible()

    // Verificar badge "Familiar"
    const badge = await page.locator('text=Familiar')
    await expect(badge).toBeVisible()

    // Verificar "por user1"
    const creator = await page.locator('text=por João')
    await expect(creator).toBeVisible()
  })
})
```

**Total de testes E2E:** ~25 testes

---

### 8.4 Testes de Permissões

```python
# tests/integration/test_permissions.py

class TestPermissions:

    async def test_can_create_transactions_false_bloqueia_household(self, client, member_bloqueado):
        """Member com can_create_transactions=False não pode criar household"""
        response = await client.post("/transactions", json={
            "amount": 100,
            "ownership_type": "household",
            # ...
        }, headers={"Authorization": f"Bearer {member_bloqueado.token}"})

        assert response.status_code == 403
        assert "sem permissão" in response.json()["detail"].lower()

    async def test_can_edit_shared_false_bloqueia_edicao_household(self, client, users_familia):
        user1, user2 = users_familia

        # User1 cria transaction household
        response = await client.post("/transactions", json={
            "amount": 100,
            "ownership_type": "household",
            # ...
        }, headers={"Authorization": f"Bearer {user1.token}"})
        transaction_id = response.json()["id"]

        # Setar can_edit_shared=False para user2
        # ...

        # User2 tenta editar
        response = await client.patch(f"/transactions/{transaction_id}", json={
            "amount": 200
        }, headers={"Authorization": f"Bearer {user2.token}"})

        assert response.status_code == 403

    async def test_owner_pode_excluir_household_de_qualquer_membro(self, client, owner, member):
        """Owner pode excluir recursos household criados por outros"""
        # Member cria transaction household
        response = await client.post("/transactions", json={
            "amount": 100,
            "ownership_type": "household",
            # ...
        }, headers={"Authorization": f"Bearer {member.token}"})
        transaction_id = response.json()["id"]

        # Owner exclui
        response = await client.delete(f"/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {owner.token}"})

        assert response.status_code == 204
```

**Total de testes de permissões:** ~20 testes

---

## 9. Migração de Dados

### 9.1 Verificar Campos Existentes

Antes de iniciar, verificar se campos já existem:

```sql
-- Verificar se ownership_type existe em cada tabela
SELECT
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'ownership_type'
ORDER BY table_name;
```

**Tabelas que devem ter ownership_type:**
- transactions
- accounts
- income_sources
- budgets
- goals
- debts
- recurring_transactions

---

### 9.2 Adicionar Campos Faltantes

Se alguma tabela não tiver o campo:

```sql
-- Exemplo: Adicionar ownership_type em budgets
ALTER TABLE budgets
ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) NOT NULL DEFAULT 'personal';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_budgets_ownership
ON budgets(user_id, ownership_type);
```

**Aplicar para todas as tabelas que não têm o campo.**

---

### 9.3 Migração de Dados Antigos

Todos os recursos antigos devem ser "personal" por padrão:

```sql
-- Atualizar recursos sem ownership_type definido
UPDATE transactions
SET ownership_type = 'personal'
WHERE ownership_type IS NULL;

UPDATE accounts
SET ownership_type = 'personal'
WHERE ownership_type IS NULL;

UPDATE income_sources
SET ownership_type = 'personal'
WHERE ownership_type IS NULL;

-- Repetir para todas as tabelas...
```

---

### 9.4 Script de Migração Completo (Alembic)

```python
# alembic/versions/xxx_add_household_support.py

"""Add household support to all resources

Revision ID: xxx
Revises: yyy
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Adicionar ownership_type em budgets (se não existir)
    op.execute("""
        ALTER TABLE budgets
        ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) NOT NULL DEFAULT 'personal'
    """)

    # Adicionar ownership_type em goals (se não existir)
    op.execute("""
        ALTER TABLE goals
        ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) NOT NULL DEFAULT 'personal'
    """)

    # Adicionar ownership_type em debts (se não existir)
    op.execute("""
        ALTER TABLE debts
        ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) NOT NULL DEFAULT 'personal'
    """)

    # Adicionar ownership_type em recurring_transactions (se não existir)
    op.execute("""
        ALTER TABLE recurring_transactions
        ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) NOT NULL DEFAULT 'personal'
    """)

    # Atualizar dados antigos
    op.execute("UPDATE budgets SET ownership_type = 'personal' WHERE ownership_type IS NULL")
    op.execute("UPDATE goals SET ownership_type = 'personal' WHERE ownership_type IS NULL")
    op.execute("UPDATE debts SET ownership_type = 'personal' WHERE ownership_type IS NULL")
    op.execute("UPDATE recurring_transactions SET ownership_type = 'personal' WHERE ownership_type IS NULL")

    # Criar índices
    op.create_index('idx_budgets_ownership', 'budgets', ['user_id', 'ownership_type'], if_not_exists=True)
    op.create_index('idx_goals_ownership', 'goals', ['user_id', 'ownership_type'], if_not_exists=True)
    op.create_index('idx_debts_ownership', 'debts', ['user_id', 'ownership_type'], if_not_exists=True)
    op.create_index('idx_recurring_ownership', 'recurring_transactions', ['user_id', 'ownership_type'], if_not_exists=True)


def downgrade():
    # Remover índices
    op.drop_index('idx_budgets_ownership', 'budgets', if_exists=True)
    op.drop_index('idx_goals_ownership', 'goals', if_exists=True)
    op.drop_index('idx_debts_ownership', 'debts', if_exists=True)
    op.drop_index('idx_recurring_ownership', 'recurring_transactions', if_exists=True)

    # Remover colunas (cuidado: perda de dados!)
    op.drop_column('budgets', 'ownership_type', if_exists=True)
    op.drop_column('goals', 'ownership_type', if_exists=True)
    op.drop_column('debts', 'ownership_type', if_exists=True)
    op.drop_column('recurring_transactions', 'ownership_type', if_exists=True)
```

---

## 10. Documentação para Usuários

### 10.1 FAQ - Gestão Familiar

#### O que é uma conta familiar?
Uma conta familiar permite que múltiplos membros (até X pessoas) compartilhem e gerenciem finanças juntos no Biveto.

#### Como funciona a visibilidade de recursos?

Existem dois tipos de visibilidade:

**Personal (Pessoal)**
- Apenas você vê
- Ideal para gastos pessoais, metas individuais, etc.
- Exemplo: "Mesada do filho", "Presente surpresa"

**Household (Familiar)**
- Todos os membros da família veem
- Ideal para despesas compartilhadas
- Exemplo: "Conta de luz", "Supermercado", "Meta de viagem em família"

#### Como criar um recurso familiar?

Ao criar uma transação, orçamento, meta, etc., você verá um seletor de visibilidade:

```
[ 👤 Pessoal ]  [ 👥 Familiar ]
```

Escolha "Familiar" para compartilhar com a família.

#### Quem pode fazer o quê?

As permissões são configuradas pelo dono da família:

| Permissão | O que permite |
|-----------|---------------|
| Criar transações | Criar transações, orçamentos, metas compartilhadas |
| Editar compartilhados | Editar recursos criados por outros membros |
| Convidar membros | Adicionar novos membros à família |
| Ver tudo | Ver inclusive recursos pessoais de outros (raro) |

#### Posso mudar um recurso de Personal para Familiar depois?

Não. Para evitar confusões, o tipo de visibilidade não pode ser alterado após a criação. Se precisar, crie um novo recurso com a visibilidade correta.

#### Como sei quem criou um recurso familiar?

Recursos familiares mostram um badge "Familiar" e o nome do criador:

```
💰 Conta de luz - R$ 250,00
   [👥 Familiar] por João
```

---

### 10.2 Tutorial: Gerenciando Finanças em Família

#### Passo 1: Convidar membros da família
1. Vá em **Configurações** → **Família**
2. Clique em **Convidar Membro**
3. Digite o email do familiar
4. Defina as permissões
5. Envie o convite

#### Passo 2: Criar um orçamento familiar
1. Vá em **Orçamentos**
2. Clique em **Novo Orçamento**
3. Escolha o mês
4. Selecione **👥 Familiar**
5. Defina valores por categoria
6. Salve

✅ Todos os membros verão e contribuirão para este orçamento!

#### Passo 3: Registrar despesas compartilhadas
1. Faça upload da fatura (água, luz, internet)
2. **Importante:** Selecione **👥 Familiar**
3. Confirme as transações
4. Todos os membros verão essas despesas

#### Passo 4: Criar uma meta familiar
1. Vá em **Metas**
2. Clique em **Nova Meta**
3. Ex: "Viagem para Disney"
4. Selecione **👥 Familiar**
5. Defina o valor alvo
6. Salve

✅ Todos podem contribuir para esta meta!

---

### 10.3 Guia de Boas Práticas

#### ✅ Use FAMILIAR para:
- Contas de consumo (água, luz, gás, internet)
- Compras de mercado
- Financiamentos e empréstimos conjuntos
- Metas de família (viagem, reforma, etc.)
- Assinaturas compartilhadas (Netflix, Spotify)
- Orçamento mensal da casa

#### ✅ Use PESSOAL para:
- Gastos individuais (roupas, hobbies)
- Presentes surpresa
- Metas pessoais (curso, investimento individual)
- Mesadas e valores recebidos individualmente

#### ⚠️ Atenção:
- Sempre defina visibilidade ao criar
- Não é possível mudar depois
- Converse com a família sobre critérios
- Use categorias consistentes

---

## Resumo Executivo

### Tempo Total Estimado de Implementação

| Fase | Tempo |
|------|-------|
| Fase 1: Infraestrutura | 3 horas |
| Fase 2: Backend (4 módulos) | 16 horas |
| Fase 3: Frontend (5 módulos) | 14 horas |
| Fase 4: Validações | 10 horas |
| Fase 5: UX | 7 horas |
| Testes | 15 horas |
| Documentação | 3 horas |
| **TOTAL** | **68 horas** (~9 dias úteis) |

### Prioridades

**🔴 Fase 1 (CRÍTICO):** 3 horas
- Criar helpers reutilizáveis
- Criar componente OwnershipSelector

**🔴 Fase 2 (CRÍTICO):** 16 horas
- Budgets
- Goals
- Debts
- Recurring
- Fix Credit Cards

**🔴 Fase 3 (CRÍTICO):** 14 horas
- Upload PDF
- Frontend de todos os módulos

**🟡 Fase 4 (IMPORTANTE):** 10 horas
- Validações de permissões

**🟢 Fases 5-6 (FUTURO):** 10+ horas
- Melhorias de UX
- Auditoria e notificações

### Dependências

```
Fase 1 (Helpers)
    ↓
Fase 2 (Backend) ──────→ Fase 3 (Frontend)
    ↓                          ↓
    └──────→ Fase 4 (Validações)
                 ↓
           Fase 5 (UX) → Fase 6 (Auditoria)
```

### Riscos

1. **Migração de dados antigos**: Todos recursos viram "personal"
2. **Breaking changes**: Schemas mudam, frontend precisa atualizar
3. **Performance**: Queries household podem ser lentas (criar índices!)
4. **Testes extensivos**: Muitos cenários para cobrir

### Recomendação

**Abordagem incremental:**
1. Semana 1: Fase 1 + Fase 2 (Backend)
2. Semana 2: Fase 3 (Frontend) + Testes
3. Semana 3: Fase 4 (Validações) + Deploy beta
4. Feedback e ajustes

---

**Fim do Documento**
