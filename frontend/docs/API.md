# Documentacao da Camada de API

## Visao Geral

A camada de API esta centralizada em `services/api.ts` e utiliza Axios para comunicacao com o backend. Inclui refresh automatico de tokens, tratamento de erros e tipagem completa.

## Configuracao

### Cliente Axios

```typescript
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Interceptors

**Request Interceptor:**
- Adiciona `Authorization: Bearer {token}` se autenticado
- Verifica expiracao do token antes de enviar

**Response Interceptor:**
- Trata erros 401 com refresh automatico
- Enfileira requisicoes durante refresh
- Traduz mensagens de erro para portugues

---

## Autenticacao

### authApi

```typescript
// Login
authApi.login(email: string, password: string): Promise<LoginResponse>

// Registro via convite
authApi.register(
  email: string,
  password: string,
  name: string,
  inviteToken?: string
): Promise<User>

// Refresh de token
authApi.refresh(refreshToken: string): Promise<TokenResponse>

// Logout
authApi.logout(): Promise<void>

// Verificar convite
authApi.verifyInvite(token: string): Promise<InviteInfo>

// Aceitar convite
authApi.acceptInvite(token: string, password: string): Promise<User>

// Solicitar reset de senha
authApi.requestPasswordReset(email: string): Promise<void>

// Reset de senha
authApi.resetPassword(token: string, password: string): Promise<void>

// Alterar senha
authApi.changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void>
```

---

## Transacoes

### transactionsApi

```typescript
// Listar com filtros
transactionsApi.list(params?: {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  account_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Transaction>>

// Criar transacao manual
transactionsApi.create(data: TransactionCreate): Promise<Transaction>

// Atualizar
transactionsApi.update(id: number, data: TransactionUpdate): Promise<Transaction>

// Excluir
transactionsApi.delete(id: number, deleteSeriesRelated?: boolean): Promise<void>

// Confirmar de documento
transactionsApi.confirm(data: TransactionConfirm): Promise<Transaction>

// Confirmar em lote
transactionsApi.batchConfirm(data: BatchConfirmRequest): Promise<BatchConfirmResponse>

// Verificar projecoes existentes
transactionsApi.checkProjected(data: CheckProjectedRequest): Promise<CheckProjectedResponse>

// Exportar CSV
transactionsApi.exportCSV(params?: {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  account_id?: number;
}): Promise<Blob>
```

---

## Documentos

### documentsApi

```typescript
// Upload de documento
documentsApi.upload(file: File): Promise<DocumentResponse>

// Listar documentos
documentsApi.list(params?: {
  limit?: number;
  offset?: number;
}): Promise<DocumentResponse[]>

// Obter documento por ID
documentsApi.get(id: number): Promise<DocumentResponse>

// Reprocessar documento
documentsApi.retry(id: number): Promise<DocumentResponse>

// Excluir documento
documentsApi.delete(id: number): Promise<void>
```

---

## Contas

### accountsApi

```typescript
// Listar contas
accountsApi.list(): Promise<Account[]>

// Obter conta
accountsApi.get(id: number): Promise<Account>

// Criar conta
accountsApi.create(data: AccountCreate): Promise<Account>

// Atualizar conta
accountsApi.update(id: number, data: AccountUpdate): Promise<Account>

// Excluir conta
accountsApi.delete(id: number): Promise<void>
```

---

## Categorias

### categoriesApi

```typescript
// Listar categorias (inclui sistema e usuario)
categoriesApi.list(): Promise<Category[]>

// Criar categoria
categoriesApi.create(data: CategoryCreate): Promise<Category>

// Atualizar categoria
categoriesApi.update(id: number, data: CategoryUpdate): Promise<Category>

// Excluir categoria
categoriesApi.delete(id: number): Promise<void>
```

---

## Cartoes de Credito

### creditCardsApi

```typescript
// Listar cartoes
creditCardsApi.list(): Promise<CreditCard[]>

// Obter cartao
creditCardsApi.get(id: number): Promise<CreditCard>

// Criar cartao
creditCardsApi.create(data: CreditCardCreate): Promise<CreditCard>

// Atualizar cartao
creditCardsApi.update(id: number, data: CreditCardUpdate): Promise<CreditCard>

// Excluir cartao
creditCardsApi.delete(id: number): Promise<void>

// Recalcular faturas
creditCardsApi.recalculateInvoices(id: number): Promise<void>

// Projetar recorrentes
creditCardsApi.projectRecurring(id: number): Promise<ProjectionResult>
```

---

## Faturas

### invoicesApi

```typescript
// Listar faturas
invoicesApi.list(params?: {
  credit_card_id?: number;
  status?: string;
}): Promise<Invoice[]>

// Obter fatura com transacoes
invoicesApi.get(id: number): Promise<InvoiceDetail>

// Criar fatura
invoicesApi.create(data: InvoiceCreate): Promise<Invoice>

// Atualizar fatura
invoicesApi.update(id: number, data: InvoiceUpdate): Promise<Invoice>

// Excluir fatura
invoicesApi.delete(id: number): Promise<void>

// Pagar fatura
invoicesApi.pay(id: number, data: InvoicePayment): Promise<Invoice>

// Listar faturas de um cartao
invoicesApi.listByCard(cardId: number): Promise<Invoice[]>

// Fatura atual de um cartao
invoicesApi.getCurrentByCard(cardId: number): Promise<InvoiceSummary>

// Detectar cartao de documento
invoicesApi.detectCard(data: DetectCardRequest): Promise<DetectCardResponse>

// Criar cartao a partir de fatura
invoicesApi.createCardFromInvoice(data: CreateCardFromInvoice): Promise<CreditCard>

// Projetar faturas futuras
invoicesApi.projectFuture(data: ProjectFutureRequest): Promise<ProjectFutureResponse>

// Reprocessar transacoes orfas
invoicesApi.reprocessOrphanTransactions(cardId: number): Promise<ReprocessResult>
```

---

## Orcamentos

### budgetsApi

```typescript
// Obter orcamento do mes
budgetsApi.get(year: number, month: number): Promise<Budget>

// Adicionar item
budgetsApi.addItem(budgetId: number, data: BudgetItemCreate): Promise<BudgetItem>

// Atualizar item
budgetsApi.updateItem(
  budgetId: number,
  itemId: number,
  data: BudgetItemUpdate
): Promise<BudgetItem>

// Excluir item
budgetsApi.deleteItem(budgetId: number, itemId: number): Promise<void>

// Copiar de outro mes
budgetsApi.copy(fromYear: number, fromMonth: number, toYear: number, toMonth: number): Promise<Budget>

// Resumo do orcamento
budgetsApi.summary(year: number, month: number): Promise<BudgetSummary>

// Comparacao planejado vs realizado
budgetsApi.comparison(year: number, month: number): Promise<BudgetComparison>
```

---

## Metas

### goalsApi

```typescript
// Listar metas
goalsApi.list(): Promise<Goal[]>

// Obter meta
goalsApi.get(id: number): Promise<Goal>

// Criar meta
goalsApi.create(data: GoalCreate): Promise<Goal>

// Atualizar meta
goalsApi.update(id: number, data: GoalUpdate): Promise<Goal>

// Excluir meta
goalsApi.delete(id: number): Promise<void>

// Adicionar contribuicao
goalsApi.addContribution(id: number, data: ContributionCreate): Promise<Contribution>

// Calcular fundo de emergencia (Dave Ramsey)
goalsApi.calculateEmergencyFund(months: number): Promise<EmergencyFundResult>

// Calcular PNIF (Gustavo Cerbasi)
goalsApi.calculatePnif(): Promise<PnifResult>
```

---

## Dividas

### debtsApi

```typescript
// Listar dividas
debtsApi.list(): Promise<Debt[]>

// Obter divida
debtsApi.get(id: number): Promise<Debt>

// Criar divida
debtsApi.create(data: DebtCreate): Promise<Debt>

// Atualizar divida
debtsApi.update(id: number, data: DebtUpdate): Promise<Debt>

// Excluir divida
debtsApi.delete(id: number): Promise<void>

// Adicionar pagamento
debtsApi.addPayment(id: number, data: PaymentCreate): Promise<Payment>

// Resumo de dividas
debtsApi.summary(): Promise<DebtSummary>

// Estrategia Snowball
debtsApi.snowball(extraPayment: number): Promise<SnowballResult>

// Estrategia Avalanche
debtsApi.avalanche(extraPayment: number): Promise<AvalancheResult>

// Comparar estrategias
debtsApi.compareStrategies(extraPayment: number): Promise<StrategyComparison>
```

---

## Transacoes Recorrentes

### recurringApi

```typescript
// Listar recorrentes
recurringApi.list(): Promise<RecurringTransaction[]>

// Obter recorrente
recurringApi.get(id: number): Promise<RecurringTransaction>

// Criar recorrente
recurringApi.create(data: RecurringCreate): Promise<RecurringTransaction>

// Atualizar recorrente
recurringApi.update(id: number, data: RecurringUpdate): Promise<RecurringTransaction>

// Excluir recorrente
recurringApi.delete(id: number): Promise<void>

// Pausar
recurringApi.pause(id: number): Promise<RecurringTransaction>

// Retomar
recurringApi.resume(id: number): Promise<RecurringTransaction>

// Resumo de recorrentes
recurringApi.summary(): Promise<RecurringSummary>

// Gerar transacoes pendentes
recurringApi.generate(id: number): Promise<Transaction[]>

// Criar de sugestao (servico detectado)
recurringApi.createFromSuggestion(data: SuggestionCreate): Promise<RecurringTransaction>

// Criar em lote de sugestoes
recurringApi.batchCreateFromSuggestion(items: SuggestionCreate[]): Promise<RecurringTransaction[]>
```

---

## Fontes de Renda

### incomeSourcesApi

```typescript
// Listar fontes
incomeSourcesApi.list(): Promise<IncomeSource[]>

// Criar fonte
incomeSourcesApi.create(data: IncomeSourceCreate): Promise<IncomeSource>

// Atualizar fonte
incomeSourcesApi.update(id: number, data: IncomeSourceUpdate): Promise<IncomeSource>

// Excluir fonte
incomeSourcesApi.delete(id: number): Promise<void>

// Preview de transacoes a gerar
incomeSourcesApi.previewTransactions(id: number): Promise<PreviewResult>

// Gerar transacoes
incomeSourcesApi.generateTransactions(id: number): Promise<Transaction[]>

// Gerar transacao unica
incomeSourcesApi.generateSingleTransaction(id: number, date: string): Promise<Transaction>
```

---

## Analytics

### analyticsApi

```typescript
// Resumo mensal
analyticsApi.summary(year: number, month: number): Promise<AnalyticsSummary>

// Insights financeiros
analyticsApi.insights(startDate: string, endDate: string): Promise<Insight[]>
```

---

## Chat (Assistente IA)

### chatApi

```typescript
// Enviar mensagem
chatApi.sendMessage(message: string): Promise<ChatResponse>

// Obter sugestoes de perguntas
chatApi.getSuggestions(): Promise<string[]>
```

---

## Familia/Household

### familyApi

```typescript
// Obter contexto familiar
familyApi.getContext(): Promise<FamilyContext>

// Listar membros
familyApi.listMembers(): Promise<FamilyMember[]>

// Remover membro
familyApi.removeMember(memberId: number): Promise<void>

// Convidar membro
familyApi.invite(email: string): Promise<Invitation>

// Listar convites
familyApi.listInvitations(): Promise<Invitation[]>

// Cancelar convite
familyApi.cancelInvitation(id: number): Promise<void>

// Reenviar convite
familyApi.resendInvitation(id: number): Promise<void>
```

---

## API Keys

### apiKeysApi

```typescript
// Listar API Keys
apiKeysApi.list(): Promise<ApiKey[]>

// Criar API Key
apiKeysApi.create(data: ApiKeyCreate): Promise<ApiKeyCreated>

// Obter API Key
apiKeysApi.get(id: number): Promise<ApiKey>

// Revogar API Key
apiKeysApi.revoke(id: number): Promise<ApiKey>

// Excluir API Key
apiKeysApi.delete(id: number): Promise<void>
```

---

## Administracao

### adminApi

```typescript
// Dashboard admin
adminApi.dashboard(): Promise<AdminDashboard>

// Usuarios
adminApi.listUsers(params?: UserListParams): Promise<PaginatedResponse<User>>
adminApi.getUser(id: number): Promise<UserDetail>
adminApi.updateUser(id: number, data: UserUpdate): Promise<User>
adminApi.resetUserPassword(id: number): Promise<{ temporaryPassword: string }>

// Licencas
adminApi.listLicenses(): Promise<License[]>
adminApi.createLicense(data: LicenseCreate): Promise<License>
adminApi.getLicense(id: number): Promise<LicenseDetail>
adminApi.updateLicense(id: number, data: LicenseUpdate): Promise<License>
adminApi.deleteLicense(id: number): Promise<void>

// Convites
adminApi.createInvite(data: InviteCreate): Promise<Invite>
adminApi.listInvites(): Promise<Invite[]>
```

---

## Tratamento de Erros

### Mensagens em Portugues

```typescript
const errorMessages: Record<string, string> = {
  'Invalid credentials': 'Email ou senha incorretos',
  'Email already registered': 'Este email ja esta cadastrado',
  'Token expired': 'Sessao expirada. Faca login novamente',
  'Insufficient permissions': 'Voce nao tem permissao para esta acao',
  // ... mais mensagens
};
```

### Tipos de Erro

```typescript
interface ApiError {
  status: number;
  message: string;
  detail?: string;
}
```

### Uso com Try/Catch

```tsx
try {
  const data = await transactionsApi.create(formData);
  toast.success('Transacao criada!');
} catch (error) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.detail || 'Erro desconhecido';
    toast.error(message);
  }
}
```

---

## React Query Integration

### Query Keys

```typescript
// Padrao de query keys
const queryKeys = {
  transactions: ['transactions'],
  transactionsList: (params) => ['transactions', 'list', params],
  accounts: ['accounts'],
  creditCards: ['credit-cards'],
  invoices: (cardId) => ['invoices', cardId],
};
```

### Exemplo de Uso

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function Transactions() {
  const queryClient = useQueryClient();

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'list', filters],
    queryFn: () => transactionsApi.list(filters),
  });

  // Mutation
  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transacao excluida!');
    },
  });

  return ( ... );
}
```

### Stale Time

```typescript
// Configuracao global em main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
  },
});
```
