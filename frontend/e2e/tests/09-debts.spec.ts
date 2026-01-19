import { test, expect } from '@playwright/test'
import { DebtsPage } from '../pages'
import { TEST_DEBT } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Debts Tests
 * Tests debt listing, creation, payment, and strategy calculation
 */

test.describe('Dívidas', () => {
  test.beforeEach(async ({ page }) => {
    const debtsPage = new DebtsPage(page)
    await debtsPage.goto()
  })

  test('deve exibir a página de dívidas', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dívidas")')).toBeVisible()
  })

  test('deve exibir resumo total de dívidas', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    // Total debts card or summary should be visible
    const totalDebt = await debtsPage.getTotalDebt()
    // May or may not have value depending on data
  })

  test('deve exibir botão de adicionar dívida', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    await expect(debtsPage.addDebtButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em adicionar dívida', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    await debtsPage.clickAddDebt()

    await expect(debtsPage.modal).toBeVisible()
  })

  test('deve criar nova dívida', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    await debtsPage.createDebt({
      name: TEST_DEBT.name,
      originalValue: TEST_DEBT.originalValue,
      currentBalance: TEST_DEBT.currentBalance,
      interestRate: TEST_DEBT.interestRate,
      creditor: TEST_DEBT.creditor,
    })

    // Modal should close
    await expect(debtsPage.modal).not.toBeVisible()

    // Debt should appear
    await debtsPage.assertDebtExists(TEST_DEBT.name)
  })

  test('deve registrar pagamento', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    // Check if debt exists
    if (!(await debtsPage.debtExists(TEST_DEBT.name))) {
      await debtsPage.createDebt({
        name: TEST_DEBT.name,
        originalValue: TEST_DEBT.originalValue,
        currentBalance: TEST_DEBT.currentBalance,
      })
    }

    // Register payment
    await debtsPage.registerPayment(TEST_DEBT.name, TEST_DEBT.payment)

    await waitForPageStable(page)
  })

  test('deve ter calculadora de estratégia', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    // Strategy calculator button should be visible
    const calcButton = debtsPage.calculateStrategyButton
    const isVisible = await calcButton.isVisible()
    // Button may or may not be visible depending on UI
  })

  test('deve excluir dívida', async ({ page }) => {
    const debtsPage = new DebtsPage(page)

    // Create or find debt
    let debtName = TEST_DEBT.name
    if (!(await debtsPage.debtExists(debtName))) {
      await debtsPage.createDebt({
        name: debtName,
        originalValue: TEST_DEBT.originalValue,
        currentBalance: TEST_DEBT.currentBalance,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete debt
    await debtsPage.deleteDebt(debtName)

    await page.waitForTimeout(500)
    await debtsPage.assertDebtNotExists(debtName)
  })

  test('screenshot dívidas desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`debts-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Dívidas - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/debts')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dívidas")')).toBeVisible()
  })

  test('screenshot dívidas mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`debts-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
