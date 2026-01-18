# Biveto App - Frontend

Aplicacao web de gestao financeira pessoal construida com React, TypeScript e Vite.

## Tech Stack

### Core
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| React | 18.2.0 | Framework UI |
| TypeScript | 5.3.3 | Tipagem estatica |
| Vite | 5.1.0 | Build tool |
| React Router | 6.22.0 | Roteamento SPA |

### Estado e Data Fetching
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| Zustand | 4.5.0 | Estado global |
| TanStack Query | 5.18.1 | Cache de servidor |
| Axios | 1.6.7 | Cliente HTTP |

### Formularios e Validacao
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| React Hook Form | 7.50.1 | Gerenciamento de forms |
| Zod | 3.22.4 | Validacao de schemas |

### UI e Estilizacao
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| Tailwind CSS | 3.4.1 | Estilos utilitarios |
| Lucide React | 0.323.0 | Icones |
| Recharts | 2.12.0 | Graficos |

### Utilitarios
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| date-fns | 3.3.1 | Manipulacao de datas |
| React Markdown | 10.1.0 | Renderizacao markdown |

### Testes
| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| Playwright | 1.57.0 | Testes E2E |

## Estrutura do Projeto

```
frontend/src/
├── pages/                 # Paginas/rotas da aplicacao
│   ├── admin/            # Paginas administrativas
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminUsers.tsx
│   │   └── AdminLicenses.tsx
│   ├── Dashboard.tsx
│   ├── Transactions.tsx
│   ├── Upload.tsx
│   ├── Budget.tsx
│   ├── Goals.tsx
│   ├── Debts.tsx
│   ├── Recurring.tsx
│   ├── Insights.tsx
│   ├── Chat.tsx
│   ├── Accounts.tsx
│   ├── CreditCards.tsx
│   ├── IncomeSources.tsx
│   ├── Invoices.tsx
│   ├── Family.tsx
│   ├── ApiKeys.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ResetPassword.tsx
│   ├── Invite.tsx
│   └── Settings.tsx
├── components/           # Componentes reutilizaveis
│   ├── shared/          # Componentes compartilhados
│   ├── credit-cards/    # Componentes de cartao de credito
│   ├── upload/          # Componentes de upload de documentos
│   ├── Layout.tsx
│   ├── FloatingAssistant.tsx
│   └── QuickTransactionModal.tsx
├── stores/              # Zustand stores
│   ├── authStore.ts
│   ├── toastStore.ts
│   ├── themeStore.ts
│   └── pwaStore.ts
├── services/            # Camada de API
│   └── api.ts
├── hooks/               # Custom hooks
│   └── usePWAInstall.ts
├── types/               # Tipos TypeScript
│   └── upload.ts
├── schemas/             # Schemas Zod
│   └── creditCard.schema.ts
├── data/                # Dados estaticos
│   ├── banks.ts
│   ├── cardBrands.ts
│   └── cardTemplates.ts
├── styles/              # Estilos globais
│   └── globals.css
├── App.tsx              # Componente principal com rotas
└── main.tsx             # Entry point
```

## Rotas da Aplicacao

### Rotas Publicas
| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/login` | Login | Autenticacao |
| `/invite/:token` | Invite | Aceitar convite |
| `/reset-password/:token` | ResetPassword | Redefinir senha |

### Rotas Protegidas
| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/` | Dashboard | Visao geral financeira |
| `/transactions` | Transactions | Lista de transacoes |
| `/upload` | Upload | Upload de documentos |
| `/budget` | Budget | Orcamento mensal |
| `/goals` | Goals | Metas financeiras |
| `/debts` | Debts | Gestao de dividas |
| `/recurring` | Recurring | Transacoes recorrentes |
| `/insights` | Insights | Analytics e insights |
| `/chat` | Chat | Assistente financeiro IA |
| `/accounts` | Accounts | Contas bancarias |
| `/credit-cards` | CreditCards | Cartoes de credito |
| `/income-sources` | IncomeSources | Fontes de renda |
| `/invoices` | Invoices | Faturas de cartao |
| `/family` | Family | Gestao familiar |
| `/api-keys` | ApiKeys | Chaves de API |
| `/settings` | Settings | Configuracoes |

### Rotas Admin
| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin` | AdminDashboard | Dashboard administrativo |
| `/admin/users` | AdminUsers | Gestao de usuarios |
| `/admin/licenses` | AdminLicenses | Gestao de licencas |

## Scripts Disponiveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento (porta 3000)

# Build
npm run build        # Build de producao (tsc + vite build)
npm run preview      # Preview do build de producao

# Linting
npm run lint         # Executa ESLint

# Testes E2E
npm run test:e2e           # Executa testes Playwright
npm run test:e2e:ui        # Abre UI do Playwright
npm run test:e2e:headed    # Executa com browser visivel
npm run test:e2e:debug     # Modo debug
npm run test:e2e:report    # Gera relatorio HTML
```

## Configuracao

### Variaveis de Ambiente
```env
VITE_API_URL=http://localhost:8000   # URL do backend
```

### Proxy de Desenvolvimento
O Vite esta configurado para fazer proxy das requisicoes `/api` para o backend:
```javascript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true
  }
}
```

## Funcionalidades PWA

A aplicacao e uma Progressive Web App com:
- Service Worker para cache offline
- Manifest para instalacao como app
- Suporte a iOS e Android
- Banner de instalacao inteligente

## Temas

Suporte a tres modos de tema:
- `light` - Tema claro
- `dark` - Tema escuro
- `system` - Segue preferencia do sistema

Cores da marca Biveto:
- Navy: `#1E3A5F`
- Green: `#4ade80`

## Arquitetura

### Gerenciamento de Estado
- **Zustand**: Estado global (auth, tema, toasts, PWA)
- **React Query**: Cache de dados do servidor com invalidacao automatica

### Camada de API
- Cliente Axios centralizado em `services/api.ts`
- Refresh automatico de tokens JWT
- Fila de requisicoes durante refresh
- Tratamento de erros em portugues

### Protecao de Rotas
- `PrivateRoute`: Requer autenticacao
- `AdminRoute`: Requer role de admin
- Redirect automatico para login

### Formularios
- React Hook Form para gerenciamento de estado
- Zod para validacao de schemas
- Tipos inferidos automaticamente

## Documentacao Adicional

- [Componentes](./docs/COMPONENTS.md) - Documentacao dos componentes
- [Stores](./docs/STORES.md) - Documentacao das stores Zustand
- [API Services](./docs/API.md) - Documentacao da camada de API
