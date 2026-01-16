# Progresso da Implementação - Gestão Familiar

**Início:** 2026-01-15
**Status:** 🟡 EM ANDAMENTO

---

## 📊 Resumo Executivo

| Fase | Status | Progresso | Tempo Estimado | Tempo Real |
|------|--------|-----------|----------------|------------|
| Fase 1: Infraestrutura | ⏳ Não iniciado | 0/2 | 3h | - |
| Fase 2: Backend (5 módulos) | ⏳ Não iniciado | 0/5 | 16h | - |
| Fase 3: Frontend (6 módulos) | ⏳ Não iniciado | 0/6 | 14h | - |
| Fase 4: Validações | ⏳ Não iniciado | 0/2 | 10h | - |
| Fase 5: Validação Final | ⏳ Não iniciado | 0/1 | - | - |
| **TOTAL** | **0%** | **0/16** | **43h** | **0h** |

---

## ✅ FASE 1: Infraestrutura (0/2)

### Task 1.1: household_helpers.py ⏳
- [ ] Criar arquivo `backend/app/modules/household/utils/household_helpers.py`
- [ ] Implementar `get_household_user_ids()`
- [ ] Implementar `get_household_member()`
- [ ] Implementar `build_ownership_filter()`
- [ ] Implementar `validate_create_permission()`
- [ ] Implementar `validate_edit_permission()`
- [ ] Implementar `validate_delete_permission()`
- [ ] Criar __init__.py para exportar funções

**Arquivos criados:**
- (nenhum ainda)

**Validação:**
- [ ] Imports funcionam
- [ ] Todas as funções têm type hints corretos
- [ ] Docstrings completas

---

### Task 1.2: OwnershipSelector.tsx ⏳
- [ ] Criar arquivo `frontend/src/components/shared/OwnershipSelector.tsx`
- [ ] Implementar componente com props corretos
- [ ] Adicionar ícones User e Users
- [ ] Estilização responsiva
- [ ] Dark mode support

**Arquivos criados:**
- (nenhum ainda)

**Validação:**
- [ ] Componente renderiza
- [ ] onChange funciona
- [ ] Acessibilidade OK

---

## 🔧 FASE 2: Backend - 5 Módulos (0/5)

### Task 2.1: Budgets Backend ⏳
- [ ] Modificar `budget_service.py` - adicionar imports
- [ ] Modificar `list()` - usar build_ownership_filter
- [ ] Modificar `create()` - validar permissão
- [ ] Modificar `update()` - validar permissão
- [ ] Modificar `delete()` - validar permissão
- [ ] Modificar `_get_expenses_by_category()` - considerar household
- [ ] Verificar BudgetCreate schema tem ownership_type
- [ ] Adicionar ownership_type ao modelo se necessário

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] GET /budgets retorna personal + household
- [ ] POST /budgets valida permissão
- [ ] Cálculo de gastos considera household
- [ ] Tests passam

---

### Task 2.2: Goals Backend ⏳
- [ ] Modificar `goal_service.py` - adicionar imports
- [ ] Modificar `list_goals()` - usar build_ownership_filter
- [ ] Modificar `create_goal()` - validar permissão
- [ ] Modificar `update_goal()` - validar permissão
- [ ] Modificar `delete_goal()` - validar permissão
- [ ] Verificar GoalCreate schema tem ownership_type
- [ ] Adicionar ownership_type ao modelo se necessário

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] GET /goals retorna personal + household
- [ ] POST /goals valida permissão
- [ ] Contribuições de outros membros somam em goal household
- [ ] Tests passam

---

### Task 2.3: Debts Backend ⏳
- [ ] Modificar `debt_service.py` - adicionar imports
- [ ] Modificar `list_debts()` - usar build_ownership_filter
- [ ] Modificar `create_debt()` - validar permissão
- [ ] Modificar `update_debt()` - validar permissão
- [ ] Modificar `delete_debt()` - validar permissão
- [ ] Modificar `get_snowball_plan()` - considerar household
- [ ] Modificar `get_avalanche_plan()` - considerar household
- [ ] Verificar DebtCreate schema tem ownership_type
- [ ] Adicionar ownership_type ao modelo se necessário

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] GET /debts retorna personal + household
- [ ] POST /debts valida permissão
- [ ] Snowball/Avalanche consideram household
- [ ] Tests passam

---

### Task 2.4: Recurring Backend ⏳
- [ ] Modificar `recurring_service.py` - adicionar imports
- [ ] Modificar `list()` - usar build_ownership_filter
- [ ] Modificar `create()` - validar permissão
- [ ] Modificar `update()` - validar permissão
- [ ] Modificar `delete()` - validar permissão
- [ ] Modificar `generate_pending_transactions()` - herdar ownership
- [ ] Adicionar ownership_type em RecurringFromSuggestionCreate
- [ ] Verificar RecurringCreate schema tem ownership_type
- [ ] Adicionar ownership_type ao modelo se necessário

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] GET /recurring retorna personal + household
- [ ] POST /recurring valida permissão
- [ ] Transações geradas herdam ownership correto
- [ ] Tests passam

---

### Task 2.5: Credit Cards - Remover Hardcode ⏳
- [ ] Modificar `credit_cards.py` router - remover hardcode linha 134
- [ ] Adicionar ownership_type em CreditCardCreate schema
- [ ] Validar permissão ao criar household
- [ ] Account criada usa ownership do data

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] POST /credit-cards aceita ownership_type
- [ ] Account criada tem ownership correto
- [ ] Tests passam

---

## 🎨 FASE 3: Frontend - 6 Módulos (0/6)

### Task 3.1: Upload PDF - Ownership Selector ⏳
- [ ] Adicionar campo ownership_type em ExtractedItem type
- [ ] Adicionar estado batchOwnershipType em Upload.tsx
- [ ] Adicionar OwnershipSelector antes da lista
- [ ] Modificar handleBatchAdd para usar batchOwnershipType
- [ ] Mostrar seletor apenas se showOwnershipSelector

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Seletor aparece quando member_count >= 2
- [ ] Transações confirmadas usam ownership escolhido
- [ ] Tests E2E passam

---

### Task 3.2: Budgets Frontend ⏳
- [ ] Verificar se página existe (criar se necessário)
- [ ] Adicionar OwnershipSelector no formulário
- [ ] Adicionar badge de ownership na listagem
- [ ] Adicionar filtro de ownership
- [ ] Mostrar "por [nome]" em budgets household

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Formulário tem seletor
- [ ] Listagem mostra ownership
- [ ] Filtro funciona

---

### Task 3.3: Goals Frontend ⏳
- [ ] Verificar se página existe (criar se necessário)
- [ ] Adicionar OwnershipSelector no formulário
- [ ] Adicionar badge de ownership na listagem
- [ ] Adicionar filtro de ownership
- [ ] Mostrar "por [nome]" em goals household

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Formulário tem seletor
- [ ] Listagem mostra ownership
- [ ] Filtro funciona

---

### Task 3.4: Debts Frontend ⏳
- [ ] Verificar se página existe (criar se necessário)
- [ ] Adicionar OwnershipSelector no formulário
- [ ] Adicionar badge de ownership na listagem
- [ ] Adicionar filtro de ownership
- [ ] Mostrar "por [nome]" em debts household

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Formulário tem seletor
- [ ] Listagem mostra ownership
- [ ] Filtro funciona

---

### Task 3.5: Recurring Frontend ⏳
- [ ] Verificar se página existe (criar se necessário)
- [ ] Adicionar OwnershipSelector no formulário
- [ ] Adicionar badge de ownership na listagem
- [ ] Adicionar filtro de ownership
- [ ] Mostrar "por [nome]" em recurring household

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Formulário tem seletor
- [ ] Listagem mostra ownership
- [ ] Filtro funciona

---

### Task 3.6: Credit Cards Frontend ⏳
- [ ] Verificar se página existe (criar se necessário)
- [ ] Adicionar OwnershipSelector no formulário
- [ ] Adicionar badge de ownership na listagem
- [ ] Account vinculada mostra ownership correto

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Formulário tem seletor
- [ ] Listagem mostra ownership

---

## 🔒 FASE 4: Validações (0/2)

### Task 4.1: Validar Permissões em Todos os Endpoints ⏳
- [ ] Transactions - create/update/delete
- [ ] Accounts - create/update/delete
- [ ] Income Sources - create/update/delete
- [ ] Budgets - create/update/delete
- [ ] Goals - create/update/delete
- [ ] Debts - create/update/delete
- [ ] Recurring - create/update/delete
- [ ] Credit Cards - create/update/delete

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Tentar criar household sem permissão (expect 403)
- [ ] Tentar editar household sem can_edit_shared (expect 403)
- [ ] Owner consegue excluir household de outros

---

### Task 4.2: Implementar can_see_all ⏳
- [ ] Modificar build_ownership_filter para aceitar member
- [ ] Passar member em todos os services
- [ ] Testar que can_see_all=True vê tudo

**Arquivos modificados:**
- (nenhum ainda)

**Validação:**
- [ ] Member com can_see_all vê personal de outros
- [ ] Member sem can_see_all vê apenas padrão

---

## ✅ FASE 5: Validação Final (0/1)

### Task 5.1: Testar Todos os Fluxos ⏳
- [ ] Cenário 1: Orçamento Familiar
- [ ] Cenário 2: Meta de Viagem
- [ ] Cenário 3: Dívida Compartilhada
- [ ] Cenário 4: Upload de Fatura
- [ ] Cenário 5: Assinatura Recorrente
- [ ] Testar permissões
- [ ] Testar filtros
- [ ] Testar badges

**Validação:**
- [ ] Todos os 5 cenários funcionam
- [ ] Sem erros no console
- [ ] Performance OK

---

## 📝 Notas e Observações

(Será preenchido durante a implementação)

---

## 🐛 Issues Encontrados

(Será preenchido se houver problemas)

---

## ✅ Checklist Final

- [ ] Todas as 16 tarefas completadas
- [ ] Todos os testes passam
- [ ] Nenhum erro no console
- [ ] Documentação atualizada
- [ ] Commit final realizado

---

**Última atualização:** Não iniciado ainda
