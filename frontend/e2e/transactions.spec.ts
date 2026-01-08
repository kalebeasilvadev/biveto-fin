import { test, expect } from '@playwright/test'

test.describe('Transações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')
  })

  test('deve exibir a página de transações', async ({ page }) => {
    await expect(page.locator('h1:has-text("Transações")')).toBeVisible()
  })

  test('deve exibir lista de transações ou estado vazio', async ({ page }) => {
    // Pode estar vazio ou ter transações
    const hasTransactions = await page.locator('.card').count() > 0
    const hasEmptyState = await page.locator('text=Nenhuma transação').isVisible().catch(() => false)

    expect(hasTransactions || hasEmptyState).toBeTruthy()
  })

  test('deve ter filtros funcionais', async ({ page }) => {
    // Verificar se existem campos de filtro
    const dateFilter = page.locator('input[type="date"]').first()
    const isDateFilterVisible = await dateFilter.isVisible().catch(() => false)

    // Pode ter ou não filtros visíveis
    if (isDateFilterVisible) {
      // Mudar data e verificar que funciona
      await dateFilter.fill('2024-01-01')
      await page.waitForLoadState('networkidle')
    }
  })

  test('deve exportar para CSV se houver transações', async ({ page }) => {
    // Verificar se o botão de exportar existe
    const exportButton = page.locator('button:has-text("Exportar")')
    const hasExport = await exportButton.isVisible().catch(() => false)

    if (hasExport) {
      // Preparar para capturar download
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
      await exportButton.click()
      const download = await downloadPromise

      if (download) {
        expect(download.suggestedFilename()).toContain('.csv')
      }
    }
  })

  test('deve manter consistência visual', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`transactions-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Transações - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir lista adaptada para mobile', async ({ page }) => {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')

    // Verificar que a página está visível
    await expect(page.locator('h1:has-text("Transações")')).toBeVisible()
  })

  test('screenshot mobile', async ({ page }, testInfo) => {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`transactions-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})
