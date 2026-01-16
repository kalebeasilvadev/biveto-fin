# Testes E2E - Biveto Frontend

Este documento descreve como executar os testes E2E do projeto Biveto.

## Pré-requisitos

- Node.js 18+
- Navegadores Playwright instalados

## Instalação

```bash
cd frontend
npm install
npx playwright install
```

## Configuração de Variáveis de Ambiente

Os testes requerem credenciais para autenticação. **NUNCA** commite credenciais no código.

### Opção 1: Arquivo .env.local (desenvolvimento)

Crie o arquivo `frontend/.env.local`:

```bash
E2E_USER_EMAIL=seu-email@exemplo.com
E2E_USER_PASSWORD=sua-senha-segura
```

### Opção 2: Variáveis de ambiente diretas

```bash
export E2E_USER_EMAIL=seu-email@exemplo.com
export E2E_USER_PASSWORD=sua-senha-segura
```

### Opção 3: CI/CD (GitHub Actions, etc.)

Configure as secrets no seu provedor de CI:
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

## Executando os Testes

### Todos os testes

```bash
npm run test:e2e
```

### Com interface visual (UI Mode)

```bash
npm run test:e2e:ui
```

### Com navegador visível (headed)

```bash
npm run test:e2e:headed
```

### Debug mode

```bash
npm run test:e2e:debug
```

### Testes específicos

```bash
# Apenas testes de tema
npx playwright test themes.spec.ts

# Apenas testes de responsividade
npx playwright test responsive.spec.ts

# Apenas testes de autenticação
npx playwright test auth.setup.ts
```

### Por projeto (browser/device)

```bash
# Desktop Chrome Light
npx playwright test --project=chromium-light

# Mobile Chrome Dark
npx playwright test --project=mobile-chrome-dark

# Tablet Light
npx playwright test --project=tablet-light
```

## Visual Testing (Screenshots)

### Gerando baselines iniciais

Na primeira execução ou ao adicionar novos testes visuais:

```bash
npm run test:e2e:update-snapshots
```

### Atualizando baselines após mudanças intencionais

```bash
npx playwright test --update-snapshots
```

### Verificando diferenças

Ao falhar um teste visual, o Playwright gera:
- `*-actual.png`: Screenshot atual
- `*-expected.png`: Baseline esperado
- `*-diff.png`: Diferença visual

Estes arquivos ficam em `frontend/test-results/`.

### Estrutura de screenshots

Os screenshots são salvos em:
```
frontend/e2e/themes.spec.ts-snapshots/
frontend/e2e/responsive.spec.ts-snapshots/
```

Cada screenshot inclui o nome do projeto no arquivo para suportar múltiplos browsers/devices.

## Relatórios

### Gerar relatório HTML

```bash
npm run test:e2e:report
```

Abre automaticamente em `frontend/playwright-report/index.html`.

## Estrutura dos Testes

```
frontend/e2e/
├── auth.setup.ts          # Setup de autenticação (roda primeiro)
├── themes.spec.ts         # Testes de tema dark/light
├── responsive.spec.ts     # Testes de responsividade
├── navigation.spec.ts     # Testes de navegação
├── dashboard.spec.ts      # Testes do dashboard
├── transactions.spec.ts   # Testes de transações
├── accounts.spec.ts       # Testes de contas
├── credit-cards.spec.ts   # Testes de cartões
├── income-sources.spec.ts # Testes de receitas
├── settings.spec.ts       # Testes de configurações
├── .auth/                 # Estado de autenticação salvo
│   └── user.json
└── README.md              # Este arquivo
```

## Projetos Configurados

O Playwright está configurado para testar em múltiplos dispositivos e temas:

### Desktop
- `chromium-light` / `chromium-dark`
- `firefox-light` / `firefox-dark`
- `webkit-light` / `webkit-dark`

### Mobile
- `mobile-chrome-light` / `mobile-chrome-dark` (Pixel 5)
- `mobile-safari-light` / `mobile-safari-dark` (iPhone 12)

### Tablet
- `tablet-light` / `tablet-dark` (iPad gen 7)

## Viewports Testados

Os testes de responsividade cobrem:
- 360x800 (mobile pequeno)
- 390x844 (iPhone 12/13)
- 412x915 (Android médio)
- 768x1024 (tablet portrait)
- 1024x768 (tablet landscape)
- 1440x900 (desktop)

## Troubleshooting

### Erro: "E2E_USER_EMAIL e E2E_USER_PASSWORD são obrigatórios"

Configure as variáveis de ambiente conforme descrito acima.

### Testes visuais falhando

1. Verifique se houve mudança intencional no layout
2. Se sim, atualize os baselines: `npm run test:e2e:update-snapshots`
3. Se não, investigue a causa da diferença visual

### Timeout em CI

Aumente o timeout no `playwright.config.ts` ou verifique a performance do servidor.

### Testes flaky

- Verifique se há animações não estabilizadas
- Use `page.waitForLoadState('networkidle')`
- Considere aumentar retries localmente

## CI/CD

Exemplo para GitHub Actions:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      - name: Install Playwright
        working-directory: frontend
        run: npx playwright install --with-deps
      - name: Run E2E tests
        working-directory: frontend
        env:
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
        run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```
