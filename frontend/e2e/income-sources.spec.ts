import { test, expect } from '@playwright/test'

test.describe('Fontes de Receita', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/income-sources')
    await page.waitForLoadState('networkidle')
  })

  test('deve exibir a página de fontes de receita', async ({ page }) => {
    await expect(page.locator('h1:has-text("Fontes de Receita")')).toBeVisible()
  })

  test('deve exibir botão de adicionar fonte', async ({ page }) => {
    await expect(page.locator('button:has-text("Nova Fonte")')).toBeVisible()
  })

  test('deve abrir modal ao clicar em nova fonte', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Verificar que o modal abriu
    await expect(page.locator('h2:has-text("Nova Fonte de Receita")')).toBeVisible()
  })

  test('deve exibir tipos de receita no select', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Clicar no select de tipo
    const typeSelect = page.locator('select').first()
    await typeSelect.click()

    // Verificar algumas opções
    await expect(page.locator('option:has-text("Salário")')).toBeAttached()
    await expect(page.locator('option:has-text("Freelance")')).toBeAttached()
    await expect(page.locator('option:has-text("Vale Alimentação")')).toBeAttached()
  })

  test('deve validar campos obrigatórios', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Botão salvar deve estar desabilitado sem nome
    const saveButton = page.locator('button:has-text("Salvar")').last()
    await expect(saveButton).toBeDisabled()
  })

  test('deve preencher formulário de fonte', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Preencher campos
    await page.fill('input[placeholder*="Salário"]', 'Salário Teste')

    // Verificar que o botão salvar está habilitado
    const saveButton = page.locator('button:has-text("Salvar")').last()
    await expect(saveButton).not.toBeDisabled()
  })

  test('deve exibir opções de frequência', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Verificar select de frequência
    const freqSelect = page.locator('select:has(option:has-text("Mensal"))')
    await expect(freqSelect).toBeVisible()
  })

  test('deve exibir card de resumo', async ({ page }) => {
    await expect(page.locator('text=Receita Mensal Esperada')).toBeVisible()
  })

  test('deve alternar visibilidade pessoal/familia', async ({ page }) => {
    await page.click('button:has-text("Nova Fonte")')

    // Clicar em pessoal
    await page.click('button:has-text("Pessoal")')
    await expect(page.locator('button:has-text("Pessoal")')).toHaveClass(/border-biveto/)

    // Clicar em familia
    await page.click('button:has-text("Familia")')
    await expect(page.locator('button:has-text("Familia")')).toHaveClass(/border-biveto/)
  })

  test('screenshot desktop', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`income-sources-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Fontes de Receita - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await page.goto('/income-sources')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1:has-text("Fontes de Receita")')).toBeVisible()
    await expect(page.locator('button:has-text("Nova Fonte")')).toBeVisible()
  })

  test('screenshot mobile', async ({ page }, testInfo) => {
    await page.goto('/income-sources')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`income-sources-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})
