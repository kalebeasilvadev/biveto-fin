import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

/**
 * Setup de autenticação que roda antes de todos os testes.
 * Faz login e salva o estado de autenticação para reutilização.
 */
setup('authenticate', async ({ page }) => {
  // Credenciais de teste - usar variáveis de ambiente em CI
  const email = process.env.TEST_USER_EMAIL || 'test@biveto.com'
  const password = process.env.TEST_USER_PASSWORD || 'Test@123456'

  // Ir para página de login
  await page.goto('/login')

  // Aguardar a página carregar
  await expect(page.locator('input[type="email"]')).toBeVisible()

  // Preencher credenciais
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)

  // Clicar em entrar
  await page.click('button[type="submit"]')

  // Aguardar redirecionamento para dashboard
  await page.waitForURL('/', { timeout: 10000 })

  // Verificar se estamos autenticados
  await expect(page.locator('text=Dashboard')).toBeVisible()

  // Salvar estado de autenticação
  await page.context().storageState({ path: authFile })
})
