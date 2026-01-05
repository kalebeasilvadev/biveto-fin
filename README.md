# App Financeiro

Aplicativo de controle financeiro pessoal com OCR inteligente para extração de dados de comprovantes.

## Stack

**Backend:**
- FastAPI + Python 3.11
- SQLAlchemy 2.0 (async) + PostgreSQL
- JWT Authentication
- OCR com Google Gemini Vision

**Frontend:**
- React 18 + TypeScript
- Vite + TailwindCSS
- React Query + Zustand
- Recharts para gráficos

## Desenvolvimento Local

### Pré-requisitos
- Python 3.11+
- Node.js 20+
- Docker (opcional, para PostgreSQL)

### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate no Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# Rodar migrations
alembic upgrade head

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse http://localhost:3000

## Deploy no Fly.io

### Configuração Inicial

1. Instale o CLI do Fly.io:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Faça login:
```bash
fly auth login
```

3. Crie os apps (apenas primeira vez):
```bash
# Backend
cd backend
fly launch --no-deploy

# Frontend
cd ../frontend
fly launch --no-deploy
```

4. Configure os secrets do backend:
```bash
cd backend
fly secrets set SECRET_KEY="sua-chave-secreta-super-segura"
fly secrets set DATABASE_URL="postgres://..."
fly secrets set GOOGLE_API_KEY="sua-api-key"
fly secrets set DEBUG="false"
fly secrets set ENVIRONMENT="production"
```

5. Crie o banco de dados PostgreSQL:
```bash
fly postgres create --name app-financeiro-db
fly postgres attach app-financeiro-db -a app-financeiro-api
```

### Deploy Manual

```bash
# Backend
cd backend
fly deploy

# Frontend
cd frontend
fly deploy
```

### Deploy Automático (GitHub Actions)

1. Gere um token no Fly.io:
```bash
fly tokens create deploy
```

2. Adicione o token como secret no GitHub:
   - Vá em Settings > Secrets and variables > Actions
   - Adicione `FLY_API_TOKEN` com o token gerado

3. Push para a branch `main` dispara o deploy automaticamente.

## Estrutura do Projeto

```
app-financeiro/
├── backend/
│   ├── app/
│   │   ├── core/          # Config, database, security
│   │   ├── models/        # SQLAlchemy models
│   │   ├── routers/       # API endpoints
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── alembic/           # Migrations
│   ├── tests/
│   ├── Dockerfile
│   └── fly.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── stores/
│   ├── Dockerfile
│   └── fly.toml
└── .github/
    └── workflows/
        ├── ci.yml         # Testes
        └── deploy.yml     # Deploy Fly.io
```

## Funcionalidades

- Dashboard com resumo financeiro
- Upload de comprovantes com OCR
- Gestão de transações manuais
- Orçamento mensal por categoria
- Metas financeiras (emergência, PNIF)
- Controle de dívidas (Snowball/Avalanche)
- Assistente IA para dúvidas
- Painel Admin para gestão de usuários

## Licença

Uso pessoal. Todos os direitos reservados.
