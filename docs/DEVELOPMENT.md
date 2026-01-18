# Guia de Desenvolvimento

Este documento contem instrucoes para desenvolvedores que trabalham no Biveto App.

## Ambiente de Desenvolvimento

### Pre-requisitos

| Ferramenta | Versao | Instalacao |
|------------|--------|------------|
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

### Configuracao Inicial

#### 1. Clonar o Repositorio

```bash
git clone https://github.com/seu-usuario/biveto-app.git
cd biveto-app
```

#### 2. Configurar Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Copiar arquivo de ambiente
cp .env.example .env
```

Editar `.env` com suas configuracoes:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/biveto

# JWT
SECRET_KEY=development-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# LLM Provider (escolha um)
VISION_PROVIDER=google
GOOGLE_API_KEY=your-api-key

# Debug
DEBUG=true
ENVIRONMENT=development
```

#### 3. Configurar Banco de Dados

```bash
# Criar banco de dados
createdb biveto

# Rodar migracoes
alembic upgrade head
```

#### 4. Configurar Frontend

```bash
cd ../frontend

# Instalar dependencias
npm install

# Copiar arquivo de ambiente
cp .env.example .env
```

Editar `.env`:

```env
VITE_API_URL=http://localhost:8000
```

### Executar o Projeto

#### Terminal 1 - Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

#### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

### URLs de Desenvolvimento

| Servico | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## Estrutura do Codigo

### Backend

```
backend/
├── app/
│   ├── core/                    # Infraestrutura
│   │   ├── config.py           # Configuracoes
│   │   ├── database.py         # Conexao BD
│   │   ├── deps.py             # Dependencias
│   │   ├── security.py         # JWT, hashing
│   │   ├── rate_limit.py       # Rate limiting
│   │   └── services/           # Servicos core
│   │
│   ├── models/                  # SQLAlchemy models
│   │   ├── __init__.py         # Exports
│   │   ├── user.py
│   │   ├── transaction.py
│   │   └── ...
│   │
│   ├── modules/                 # Modulos de features
│   │   ├── auth/
│   │   │   ├── schemas/        # Pydantic
│   │   │   ├── services/       # Logica
│   │   │   ├── routers/        # Endpoints
│   │   │   └── README.md
│   │   ├── transactions/
│   │   └── ...
│   │
│   ├── routers/                 # Agregador de routers
│   │   └── __init__.py
│   │
│   └── main.py                  # Entry point
│
├── alembic/                     # Migracoes
├── tests/                       # Testes
├── uploads/                     # Arquivos enviados
├── requirements.txt
└── .env
```

### Frontend

```
frontend/
├── src/
│   ├── pages/                   # Paginas (rotas)
│   │   ├── Dashboard.tsx
│   │   ├── Transactions.tsx
│   │   └── ...
│   │
│   ├── components/              # Componentes
│   │   ├── shared/             # Reutilizaveis
│   │   ├── upload/             # Upload flow
│   │   ├── credit-cards/       # Cartoes
│   │   └── Layout.tsx
│   │
│   ├── stores/                  # Zustand stores
│   │   ├── authStore.ts
│   │   ├── toastStore.ts
│   │   └── ...
│   │
│   ├── services/                # API
│   │   └── api.ts
│   │
│   ├── hooks/                   # Custom hooks
│   ├── types/                   # TypeScript types
│   ├── schemas/                 # Zod schemas
│   ├── data/                    # Dados estaticos
│   ├── styles/                  # CSS global
│   │
│   ├── App.tsx                  # Rotas
│   └── main.tsx                 # Entry point
│
├── public/                      # Assets estaticos
├── e2e/                         # Testes Playwright
└── package.json
```

---

## Convencoes de Codigo

### Backend (Python)

#### Nomenclatura

```python
# Classes: PascalCase
class TransactionService:
    pass

# Funcoes e variaveis: snake_case
def calculate_total(transactions: list) -> Decimal:
    total_amount = Decimal(0)
    return total_amount

# Constantes: UPPER_SNAKE_CASE
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Arquivos: snake_case
# transaction_service.py
```

#### Estrutura de Modulo

```python
# 1. Imports da biblioteca padrao
from datetime import datetime
from decimal import Decimal

# 2. Imports de terceiros
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Imports locais
from app.core.deps import CurrentUser, DbSession
from app.models import Transaction
from .schemas import TransactionCreate, TransactionResponse

# 4. Constantes
ITEMS_PER_PAGE = 50

# 5. Classes/Funcoes
class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, user_id: int) -> list[Transaction]:
        ...
```

#### Docstrings

```python
async def create_transaction(
    self,
    user: User,
    data: TransactionCreate,
) -> Transaction:
    """
    Cria uma nova transacao para o usuario.

    Args:
        user: Usuario autenticado
        data: Dados da transacao

    Returns:
        Transacao criada

    Raises:
        HTTPException: Se a conta nao existir
    """
```

### Frontend (TypeScript)

#### Nomenclatura

```typescript
// Componentes: PascalCase
function TransactionList() { ... }

// Hooks: camelCase com prefixo use
function useTransactions() { ... }

// Stores: camelCase com sufixo Store
const useAuthStore = create(...)

// Tipos/Interfaces: PascalCase
interface Transaction { ... }
type TransactionType = 'income' | 'expense';

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Arquivos:
// Componentes: PascalCase.tsx
// Outros: camelCase.ts
```

#### Estrutura de Componente

```typescript
// 1. Imports
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '@/services/api';

// 2. Types
interface TransactionListProps {
  accountId?: number;
  onSelect?: (tx: Transaction) => void;
}

// 3. Component
export function TransactionList({ accountId, onSelect }: TransactionListProps) {
  // 3.1 State
  const [filter, setFilter] = useState('');

  // 3.2 Queries
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', accountId],
    queryFn: () => transactionsApi.list({ account_id: accountId }),
  });

  // 3.3 Effects
  useEffect(() => {
    // ...
  }, []);

  // 3.4 Handlers
  const handleClick = (tx: Transaction) => {
    onSelect?.(tx);
  };

  // 3.5 Render
  if (isLoading) return <Loading />;

  return (
    <div>
      {data?.map(tx => (
        <TransactionItem key={tx.id} transaction={tx} onClick={handleClick} />
      ))}
    </div>
  );
}
```

---

## Fluxo de Trabalho

### Git Workflow

```bash
# 1. Criar branch a partir de main
git checkout main
git pull origin main
git checkout -b feature/nova-funcionalidade

# 2. Desenvolver e commitar
git add .
git commit -m "feat: adiciona nova funcionalidade"

# 3. Manter atualizado com main
git fetch origin
git rebase origin/main

# 4. Push e criar PR
git push -u origin feature/nova-funcionalidade
```

### Convencao de Commits

Seguimos [Conventional Commits](https://conventionalcommits.org/):

```
<tipo>(<escopo>): <descricao>

[corpo opcional]

[rodape opcional]
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correcao de bug
- `docs`: Documentacao
- `style`: Formatacao
- `refactor`: Refatoracao
- `test`: Testes
- `chore`: Manutencao

**Exemplos:**
```
feat(transactions): adiciona filtro por categoria
fix(auth): corrige refresh de token expirado
docs(readme): atualiza instrucoes de instalacao
refactor(documents): extrai validacao para service separado
```

### Code Review

Antes de aprovar um PR, verificar:

1. **Funcionalidade**: Codigo faz o que deveria?
2. **Testes**: Tem cobertura adequada?
3. **Seguranca**: Nao introduz vulnerabilidades?
4. **Performance**: Nao causa regressao?
5. **Documentacao**: Esta atualizada?

---

## Testes

### Backend

```bash
cd backend

# Rodar todos os testes
pytest

# Com cobertura
pytest --cov=app --cov-report=html

# Testes especificos
pytest tests/test_transactions.py
pytest -k "test_create"
```

### Frontend

```bash
cd frontend

# Testes E2E com Playwright
npm run test:e2e

# Modo interativo
npm run test:e2e:ui

# Com browser visivel
npm run test:e2e:headed

# Debug
npm run test:e2e:debug
```

---

## Banco de Dados

### Migracoes

```bash
cd backend

# Criar nova migracao
alembic revision --autogenerate -m "descricao da mudanca"

# Aplicar migracoes
alembic upgrade head

# Reverter ultima migracao
alembic downgrade -1

# Ver historico
alembic history
```

### Reset do Banco

```bash
# Apagar e recriar
dropdb biveto
createdb biveto
alembic upgrade head
```

---

## Debugging

### Backend

```python
# Adicionar breakpoint
import pdb; pdb.set_trace()

# Ou usar debugpy para VS Code
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()
```

### Frontend

```typescript
// Console
console.log('Debug:', data);

// Debugger statement
debugger;

// React Query Devtools (ja configurado)
// Zustand Devtools (ja configurado)
```

---

## Ferramentas Uteis

### Backend

```bash
# Formatar codigo
black app
isort app

# Verificar tipos
mypy app

# Lint
ruff app
```

### Frontend

```bash
# Lint
npm run lint

# Formatar (se configurado)
npm run format
```

---

## Troubleshooting

### Erro de CORS

```python
# Verificar configuracao em main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Erro de Conexao com Banco

```bash
# Verificar se PostgreSQL esta rodando
pg_isready

# Verificar DATABASE_URL no .env
echo $DATABASE_URL
```

### Token Expirado

O frontend faz refresh automatico, mas se persistir:

```typescript
// Limpar storage e relogar
localStorage.clear();
window.location.href = '/login';
```

### LLM Nao Funciona

1. Verificar API Key no `.env`
2. Verificar `VISION_PROVIDER`
3. Verificar logs do backend

```bash
# Ver logs em tempo real
uvicorn app.main:app --reload --log-level debug
```

---

## Recursos

### Documentacao

- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/)
- [React](https://react.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS](https://tailwindcss.com/)

### Ferramentas

- [Postman](https://postman.com/) - Testar API
- [DBeaver](https://dbeaver.io/) - Cliente PostgreSQL
- [React DevTools](https://react.dev/learn/react-developer-tools)
