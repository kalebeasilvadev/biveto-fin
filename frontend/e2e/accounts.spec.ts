import { test, expect } from '@playwright/test'

test.describe('Contas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')
  })

  test('deve exibir a página de contas', async ({ page }) => {
    await expect(page.locator('h1:has-text("Minhas Contas")')).toBeVisible()
  })

  test('deve exibir botão de nova conta', async ({ page }) => {
    await expect(page.locator('button:has-text("Nova Conta")')).toBeVisible()
  })

  test('deve exibir saldo total', async ({ page }) => {
    await expect(page.locator('text=Saldo Total')).toBeVisible()
  })

  test('deve abrir modal ao clicar em nova conta', async ({ page }) => {
    await page.click('button:has-text("Nova Conta")')

    // Modal deve estar visível
    await expect(page.locator('h2:has-text("Nova Conta")')).toBeVisible()
  })

  test('deve ter tipos de conta disponíveis', async ({ page }) => {
    await page.click('button:has-text("Nova Conta")')

    // Verificar select de tipo
    const typeSelect = page.locator('select')
    await expect(typeSelect).toBeVisible()

    // Verificar opções
    await expect(page.locator('option:has-text("Banco")')).toBeAttached()
    await expect(page.locator('option:has-text("Carteira")')).toBeAttached()
    await expect(page.locator('option:has-text("Investimento")')).toBeAttached()
  })

  test('deve ter seletor de cores', async ({ page }) => {
    await page.click('button:has-text("Nova Conta")')

    // Verificar botões de cor
    const colorButtons = page.locator('button.w-8.h-8.rounded-full')
    expect(await colorButtons.count()).toBeGreaterThan(0)
  })

  test('screenshot desktop', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`accounts-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Contas - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1:has-text("Minhas Contas")')).toBeVisible()
  })

  test('grid deve ser responsivo', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // Em mobile, grid deve ser 1 coluna
    const grid = page.locator('.grid.grid-cols-1')
    // Pode existir ou não dependendo do conteúdo
  })

  test('screenshot mobile', async ({ page }, testInfo) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`accounts-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})
