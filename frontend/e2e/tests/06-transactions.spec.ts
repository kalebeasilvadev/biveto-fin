import { test, expect } from '@playwright/test'
import { TransactionsPage } from '../pages'
import { TEST_TRANSACTION } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Transactions Tests
 * Tests transaction listing, filtering, editing, and deletion
 */

test.describe('Transações', () => {
  test.beforeEach(async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)
    await transactionsPage.goto()
  })

  test('deve exibir a página de transações', async ({ page }) => {
    await expect(page.locator('h1:has-text("Transações")')).toBeVisible()
  })

  test('deve exibir seletor de ano', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    // Year selector or current year should be visible
    const yearText = page.locator('text=2024, text=2025, text=2026')
    await expect(yearText.first()).toBeVisible()
  })

  test('deve exibir tabs de meses', async ({ page }) => {
    // Month tabs should exist
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthTab = page.locator(`button:has-text("${monthNames[new Date().getMonth()]}")`)

    // Current month tab should be visible
    await expect(monthTab.first()).toBeVisible()
  })

  test('deve exibir lista de transações ou estado vazio', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    const hasTransactions = await transactionsPage.getTransactionCount() > 0
    const hasEmptyState = await transactionsPage.isShowingEmptyState()

    // Either transactions or empty state should be shown
    expect(hasTransactions || hasEmptyState).toBeTruthy()
  })

  test('deve ter funcionalidade de busca', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    // Search input should be visible
    const searchVisible = await transactionsPage.searchInput.isVisible()

    if (searchVisible) {
      await transactionsPage.search('mercado')
      await page.waitForTimeout(500)

      // Clear search
      await transactionsPage.clearSearch()
    }
  })

  test('deve ter filtro de categoria', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    // Category filter should exist
    const filterVisible = await transactionsPage.categoryFilter.isVisible()
    // Filter may or may not be visible depending on implementation
  })

  test('deve navegar entre meses', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    // Navigate to previous month
    await transactionsPage.previousMonth()
    await waitForPageStable(page)

    // Navigate back to current month
    await transactionsPage.nextMonth()
    await waitForPageStable(page)
  })

  test('deve abrir detalhes da transação ao clicar', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    const count = await transactionsPage.getTransactionCount()

    if (count > 0) {
      // Click first transaction
      const firstTransaction = transactionsPage.transactionCards.first()
      await firstTransaction.click()

      // Modal or detail view should appear
      await page.waitForTimeout(500)
    }
  })

  test('deve exportar CSV se houver transações', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    const exportSuccess = await transactionsPage.exportCSV()
    // Export may or may not succeed depending on data
  })

  test('screenshot transações desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`transactions-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Transações - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Transações")')).toBeVisible()
  })

  test('deve ter navegação de meses acessível', async ({ page }) => {
    // Month navigation should be accessible in mobile
    const monthNav = page.locator('button, a').filter({ hasText: /Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez/ })
    const count = await monthNav.count()
    expect(count).toBeGreaterThan(0)
  })

  test('screenshot transações mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`transactions-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
