import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração Playwright para testes E2E do Biveto
 * Testa em múltiplos dispositivos, temas e viewports
 *
 * Variáveis de ambiente:
 * - E2E_USER_EMAIL: Email para login nos testes
 * - E2E_USER_PASSWORD: Senha para login nos testes
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* Retry em CI e local para reduzir flakiness */
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  /* Timeout global */
  timeout: 60000,
  expect: {
    /* Timeout para assertions */
    timeout: 10000,
    /* Configuração de screenshots para visual testing */
    toHaveScreenshot: {
      /* Threshold para diferenças aceitáveis (15%) */
      maxDiffPixelRatio: 0.15,
      /* Animações devem estar desabilitadas */
      animations: 'disabled',
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.15,
    },
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    /* Desabilitar animações para testes mais estáveis */
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers and devices */
  projects: [
    // Setup project for authentication
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Desktop browsers - Light theme
    {
      name: 'chromium-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-light',
      use: {
        ...devices['Desktop Firefox'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-light',
      use: {
        ...devices['Desktop Safari'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Desktop browsers - Dark theme
    {
      name: 'chromium-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-dark',
      use: {
        ...devices['Desktop Firefox'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-dark',
      use: {
        ...devices['Desktop Safari'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile devices - Light theme
    {
      name: 'mobile-chrome-light',
      use: {
        ...devices['Pixel 5'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari-light',
      use: {
        ...devices['iPhone 12'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile devices - Dark theme
    {
      name: 'mobile-chrome-dark',
      use: {
        ...devices['Pixel 5'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari-dark',
      use: {
        ...devices['iPhone 12'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Tablet
    {
      name: 'tablet-light',
      use: {
        ...devices['iPad (gen 7)'],
        colorScheme: 'light',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'tablet-dark',
      use: {
        ...devices['iPad (gen 7)'],
        colorScheme: 'dark',
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
