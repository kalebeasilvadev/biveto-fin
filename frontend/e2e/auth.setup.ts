import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

/**
 * Setup de autenticação que roda antes de todos os testes.
 * Faz login e salva o estado de autenticação para reutilização.
 *
 * Variáveis de ambiente necessárias:
 * - E2E_USER_EMAIL: Email do usuário de teste
 * - E2E_USER_PASSWORD: Senha do usuário de teste
 */
setup('authenticate', async ({ page }) => {
  // Credenciais de teste - OBRIGATÓRIO usar variáveis de ambiente
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL e E2E_USER_PASSWORD são obrigatórios. ' +
      'Configure as variáveis de ambiente antes de rodar os testes.'
    )
  }

  // Ir para página de login
  await page.goto('/login')

  // Aguardar a página carregar
  await page.waitForLoadState('networkidle')
  await expect(page.locator('input[type="email"]')).toBeVisible()

  // Preencher credenciais
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)

  // Clicar em entrar e aguardar resposta
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/auth/') && response.status() === 200, { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])

  // Aguardar um pouco para o redirecionamento processar
  await page.waitForTimeout(2000)

  // Verificar se houve erro de login
  const errorMessage = page.locator('text=Email ou senha incorretos')
  if (await errorMessage.isVisible()) {
    throw new Error('Login failed: Invalid credentials. Please check E2E_USER_EMAIL and E2E_USER_PASSWORD environment variables.')
  }

  // Aguardar redirecionamento para dashboard (ou já estar lá)
  await page.waitForURL('/', { timeout: 15000 }).catch(async () => {
    // Se ainda não redirecionou, verificar se já está autenticado
    const currentUrl = page.url()
    if (!currentUrl.endsWith('/')) {
      throw new Error(`Expected to be redirected to /, but current URL is: ${currentUrl}`)
    }
  })

  // Verificar se estamos autenticados (usar locator mais específico)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })

  // Salvar estado de autenticação
  await page.context().storageState({ path: authFile })
})
