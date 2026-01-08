import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração Playwright para testes E2E do Biveto
 * Testa em múltiplos dispositivos, temas e viewports
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
