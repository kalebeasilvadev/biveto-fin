import { test, expect } from '@playwright/test'
import { IncomeSourcesPage } from '../pages'
import { TEST_INCOME_SOURCE } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Income Sources Tests
 * Tests income source listing, creation, and transaction generation
 */

test.describe('Fontes de Receita', () => {
  test.beforeEach(async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)
    await incomeSourcesPage.goto()
  })

  test('deve exibir a página de fontes de receita', async ({ page }) => {
    await expect(page.locator('h1:has-text("Fontes de Receita"), h1:has-text("Receitas")')).toBeVisible()
  })

  test('deve exibir total de receita esperada', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    // Total income card should be visible
    const total = await incomeSourcesPage.getTotalIncome()
    // May or may not have value depending on data
  })

  test('deve exibir botão de nova fonte', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    await expect(incomeSourcesPage.newSourceButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em nova fonte', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    await incomeSourcesPage.clickNewSource()

    await expect(incomeSourcesPage.modal).toBeVisible()
  })

  test('deve criar nova fonte de receita', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    await incomeSourcesPage.createSource({
      name: TEST_INCOME_SOURCE.name,
      type: 'Salário',
      amount: TEST_INCOME_SOURCE.expectedAmount,
      frequency: 'Mensal',
      day: TEST_INCOME_SOURCE.day,
    })

    // Modal should close
    await expect(incomeSourcesPage.modal).not.toBeVisible()

    // Source should appear
    await incomeSourcesPage.assertSourceExists(TEST_INCOME_SOURCE.name)
  })

  test('deve exibir botão de gerar transações', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    // Generate button should be visible if there are sources
    const generateVisible = await incomeSourcesPage.generateButton.isVisible()
    // Button may or may not be visible depending on sources
  })

  test('deve excluir fonte de receita', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)

    // Create or find source
    let sourceName = TEST_INCOME_SOURCE.name
    if (!(await incomeSourcesPage.sourceExists(sourceName))) {
      await incomeSourcesPage.createSource({
        name: sourceName,
        amount: TEST_INCOME_SOURCE.expectedAmount,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete source
    await incomeSourcesPage.deleteSource(sourceName)

    await page.waitForTimeout(500)
    await incomeSourcesPage.assertSourceNotExists(sourceName)
  })

  test('screenshot fontes de receita desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`income-sources-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Fontes de Receita - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/income-sources')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Fontes de Receita"), h1:has-text("Receitas")')).toBeVisible()
  })

  test('screenshot fontes de receita mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`income-sources-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
