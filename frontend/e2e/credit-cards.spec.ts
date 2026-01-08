import { test, expect } from '@playwright/test'

test.describe('Cartões de Crédito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/credit-cards')
    await page.waitForLoadState('networkidle')
  })

  test('deve exibir a página de cartões', async ({ page }) => {
    await expect(page.locator('h1:has-text("Cartões de Crédito")')).toBeVisible()
  })

  test('deve exibir botão de adicionar cartão', async ({ page }) => {
    await expect(page.locator('button:has-text("Novo Cartão")')).toBeVisible()
  })

  test('deve abrir modal ao clicar em novo cartão', async ({ page }) => {
    await page.click('button:has-text("Novo Cartão")')

    // Verificar que o modal abriu
    await expect(page.locator('text=Nome do Cartão')).toBeVisible()
  })

  test('deve fechar modal ao clicar em cancelar', async ({ page }) => {
    await page.click('button:has-text("Novo Cartão")')
    await expect(page.locator('text=Nome do Cartão')).toBeVisible()

    await page.click('button:has-text("Cancelar")')
    await expect(page.locator('text=Nome do Cartão')).not.toBeVisible()
  })

  test('deve validar campos obrigatórios', async ({ page }) => {
    await page.click('button:has-text("Novo Cartão")')

    // Tentar salvar sem preencher
    const saveButton = page.locator('button:has-text("Salvar")').last()
    await expect(saveButton).toBeDisabled()
  })

  test('deve preencher formulário de cartão', async ({ page }) => {
    await page.click('button:has-text("Novo Cartão")')

    // Preencher campos
    await page.fill('input[placeholder*="Nubank"]', 'Teste Cartão')
    await page.fill('input[placeholder*="10000"]', '5000')

    // Verificar que o botão salvar está habilitado
    const saveButton = page.locator('button:has-text("Salvar")').last()
    await expect(saveButton).not.toBeDisabled()
  })

  test('deve exibir opções de programa de pontos', async ({ page }) => {
    await page.click('button:has-text("Novo Cartão")')

    // Marcar checkbox de pontos
    await page.check('input[type="checkbox"]')

    // Verificar que aparece o seletor de programa
    await expect(page.locator('text=Programa')).toBeVisible()
    await expect(page.locator('text=Fator')).toBeVisible()
  })

  test('deve exibir cards de resumo', async ({ page }) => {
    // Verificar presença dos cards de resumo
    await expect(page.locator('text=Limite Total')).toBeVisible()
    await expect(page.locator('text=Total Utilizado')).toBeVisible()
    await expect(page.locator('text=Limite Disponível')).toBeVisible()
  })

  test('screenshot desktop', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`credit-cards-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Cartões de Crédito - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await page.goto('/credit-cards')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1:has-text("Cartões de Crédito")')).toBeVisible()
    await expect(page.locator('button:has-text("Novo Cartão")')).toBeVisible()
  })

  test('modal deve funcionar no mobile', async ({ page }) => {
    await page.goto('/credit-cards')
    await page.waitForLoadState('networkidle')

    await page.click('button:has-text("Novo Cartão")')
    await expect(page.locator('text=Nome do Cartão')).toBeVisible()

    // Verificar scroll no modal
    await page.locator('.max-h-\\[70vh\\]').scrollIntoViewIfNeeded()
  })

  test('screenshot mobile', async ({ page }, testInfo) => {
    await page.goto('/credit-cards')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`credit-cards-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})
