# Biveto App

[![CI](https://github.com/kalebeasilvadev/biveto-fin/actions/workflows/ci.yml/badge.svg)](https://github.com/kalebeasilvadev/biveto-fin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Sistema completo de gestao financeira pessoal com suporte a familias, extracao inteligente de documentos via IA e assistente financeiro.

> **Novo no time?** Comece pelo **[guia de onboarding](docs/onboarding/README.md)** (o que e o app, setup Windows/Linux, mapa do codigo, decisoes de arquitetura) e pelo **[CONTRIBUTING.md](CONTRIBUTING.md)** (fluxo de branches, PRs e definition of done).

## Visao Geral

O Biveto e uma aplicacao web de gestao financeira que permite:

- **Gestao de Transacoes**: Controle completo de receitas e despesas
- **Extracao Inteligente**: Upload de faturas e documentos com extracao automatica via LLM
- **Cartoes de Credito**: Gestao de cartoes, faturas e parcelamentos
- **Orcamento**: Planejamento mensal com comparativo real vs planejado
- **Metas Financeiras**: Acompanhamento de objetivos com metodologias (Dave Ramsey, PNIF)
- **Gestao de Dividas**: Estrategias Snowball e Avalanche para quitacao
- **Familia/Household**: Compartilhamento de contas entre membros da familia
- **Assistente IA**: Chat inteligente para analise financeira
- **Integracao MCP**: API para acesso via Claude Code e ChatGPT

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + PWA)                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Pages   │  │Components│  │ Stores  │  │Services │           │
│  │ (37)    │  │por domain│  │ Zustand │  │ Axios   │           │
│  └─────────┘  └──────────┘  └─────────┘  └─────────┘           │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API (JWT)
┌─────────────────────────────▼───────────────────────────────────┐
│                        BACKEND (FastAPI)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Modules (29)                        │   │
│  │  auth, accounts, transactions, documents, credit_cards   │   │
│  │  benefit_cards, budgets, goals, debts, recurring,        │   │
│  │  analytics, chat, income, income_splits, installments,   │   │
│  │  known_services, household, admin, api_keys, mcp,        │   │
│  │  categories, grocery, gamification, notifications,       │   │
│  │  automations, receipts, calendar, review                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core Services                         │   │
│  │  • LLM Vision (Gemini padrao; Mistral alternativo)      │   │
│  │  • JWT Authentication + API Keys                        │   │
│  │  • APScheduler (jobs agendados)                         │   │
│  │  • Rate Limiting / Email Service                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ SQLAlchemy 2.0 (async)
┌─────────────────────────────▼───────────────────────────────────┐
│                  SQLite (dev) / PostgreSQL (prod)               │
│  Users, Accounts, Transactions, CreditCards, Invoices, etc.    │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| Python | 3.11+ | Linguagem |
| FastAPI | 0.109 | Framework web |
| SQLAlchemy | 2.0 | ORM (async) |
| SQLite / PostgreSQL | - | Banco de dados (SQLite por padrao) |
| Pydantic | 2.0 | Validacao |
| JWT | - | Autenticacao |

### Frontend
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| React | 18.2 | Framework UI |
| TypeScript | 5.3 | Tipagem |
| Vite | 5.1 | Build tool |
| Zustand | 4.5 | Estado global |
| TanStack Query | 5.18 | Cache de servidor |
| Tailwind CSS | 3.4 | Estilizacao |

### Integracao IA
| Provider | Modelo | Uso |
|----------|--------|-----|
| Google | Gemini Flash | Extracao de documentos e chat (**padrao** — 2.2x mais rapido nos benchmarks internos, camada gratuita) |
| Mistral | OCR + Large | Extracao (alternativo, SDK instalado) |
| OpenAI / Anthropic | - | Providers implementados mas sem SDK instalado (ver ADR-004 em [docs/onboarding](docs/onboarding/03-DECISOES-E-MOTIVOS.md)) |

## Estrutura do Projeto

```
biveto-app/
├── README.md                 # Este arquivo
├── docs/                     # Documentacao centralizada
│   ├── README.md            # Indice da documentacao
│   ├── architecture/        # Arquitetura e database schema
│   ├── development/         # Guias de desenvolvimento
│   ├── frontend/            # Docs do frontend
│   ├── backend/             # Docs do backend
│   ├── business/            # Regras de negocio e audit
│   └── integrations/        # Integracoes externas
├── backend/                  # API FastAPI
│   ├── app/
│   │   ├── core/            # Configuracao, seguranca, deps
│   │   ├── models/          # Models SQLAlchemy
│   │   ├── modules/         # Modulos de funcionalidades
│   │   └── main.py          # Entry point
│   └── requirements.txt
└── frontend/                 # SPA React
    ├── src/
    │   ├── pages/           # Paginas/rotas
    │   ├── components/      # Componentes
    │   ├── stores/          # Zustand stores
    │   ├── services/        # Camada de API
    │   └── App.tsx
    └── package.json
```

## Funcionalidades Principais

### 1. Extracao Inteligente de Documentos
- Upload de PDF, imagens, CSV, Excel
- Extracao automatica via LLM Vision
- Suporte a faturas de todos os bancos brasileiros
- Deteccao de parcelamentos
- Identificacao de servicos recorrentes (Netflix, Spotify, etc.)

### 2. Gestao de Cartoes de Credito
- Cadastro com templates pre-definidos
- Controle de limite e faturas
- Deteccao automatica de cartao em faturas
- Projecao de gastos recorrentes

### 3. Orcamento Mensal
- Planejamento por categoria
- Comparativo planejado vs realizado
- Copia entre meses
- Alerta de estouro

### 4. Metas Financeiras
- Tipos: poupanca, emergencia, quitacao, investimento
- Calculo de fundo de emergencia (Dave Ramsey)
- Calculo de PNIF (Gustavo Cerbasi)
- Contribuicoes e projecoes

### 5. Gestao de Dividas
- Cadastro com juros e parcelas
- Estrategia Snowball (menor saldo primeiro)
- Estrategia Avalanche (maior juros primeiro)
- Comparativo de estrategias

### 6. Familia/Household
- Convite de membros por email
- Compartilhamento de contas e transacoes
- Controle de permissoes
- Migracao de dados pessoais

### 7. Assistente IA
- Chat para analise financeira
- Sugestoes contextuais
- Insights sobre gastos

### 8. Integracao MCP
- API para Claude Code e ChatGPT
- Consultas de dados financeiros
- Contexto agregado para IA

## Quick Start

### Pre-requisitos
- Python 3.11+
- Node.js 20+
- API Key do Google (opcional — necessaria apenas para extracao de documentos e chat IA; gratuita em https://aistudio.google.com/apikey)

> O banco padrao e SQLite (sem instalacao extra). Para usar PostgreSQL local, suba o container com `make docker-up`.

### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas configuracoes

# Rodar migracoes (cria o banco SQLite com todas as tabelas)
alembic upgrade head

# Criar seu usuario (o registro publico e desabilitado — entrada por convite)
python scripts/create_admin.py voce@exemplo.com 'SuaSenha@123' 'Seu Nome'

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas configuracoes

# Iniciar servidor de desenvolvimento
npm run dev
```

### Acessar

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/docs

## Configuracao

### Variaveis de Ambiente - Backend

```env
# Database (SQLite por padrao; PostgreSQL local via make docker-up)
DATABASE_URL=sqlite+aiosqlite:///./financeiro.db
# DATABASE_URL=postgresql+asyncpg://biveto:biveto_secret@localhost:5433/biveto_db

# JWT
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# LLM Providers
VISION_PROVIDER=google  # google, openai, anthropic, mistral
GOOGLE_API_KEY=xxx
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
MISTRAL_API_KEY=xxx

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=xxx
SMTP_PASSWORD=xxx
```

### Variaveis de Ambiente - Frontend

```env
VITE_API_URL=http://localhost:8000
```

## Documentacao

Toda documentacao esta centralizada na pasta [`docs/`](./docs/README.md).

| Documento | Descricao |
|-----------|-----------|
| [Indice Geral](./docs/README.md) | Navegacao completa da documentacao |
| [Arquitetura](./docs/architecture/OVERVIEW.md) | Arquitetura detalhada do sistema |
| [Database Schema](./docs/architecture/DATABASE_SCHEMA.md) | Esquema do banco de dados |
| [Getting Started](./docs/development/GETTING_STARTED.md) | Guia para desenvolvedores |
| [Convencoes](./docs/development/CONVENTIONS.md) | Padroes de codigo |
| [Backend](./docs/backend/README.md) | Documentacao do backend |
| [Modulos](./docs/backend/MODULES.md) | Descricao dos modulos (29 atualmente — lista completa no [mapa do codigo](./docs/onboarding/02-MAPA-DO-CODIGO.md)) |
| [Frontend](./docs/frontend/README.md) | Documentacao do frontend |
| [Regras de Negocio](./docs/business/LOGIC_MAP.md) | Mapa logico do sistema |
| [Integracoes](./docs/integrations/MISTRAL_INTEGRATION.md) | Integracao com Mistral OCR |

## Scripts Uteis

### Backend
```bash
# Rodar testes
pytest

# Lint (mesmas regras do CI)
ruff check .

# Formatar codigo (formatador oficial do projeto — compativel com Black)
ruff format .
```

### Frontend
```bash
# Build de producao
npm run build

# Testes E2E
npm run test:e2e

# Lint
npm run lint
```

## Licenca

Distribuido sob a licenca [MIT](LICENSE) — livre para usar, modificar e distribuir, mantendo o aviso de copyright.
