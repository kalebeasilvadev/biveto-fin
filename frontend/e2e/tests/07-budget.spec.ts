import { test, expect } from '@playwright/test'
import { BudgetPage } from '../pages'
import { TEST_BUDGET_ITEM } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Budget Tests
 * Tests budget display, creation, and management
 */

test.describe('Orçamento', () => {
  test.beforeEach(async ({ page }) => {
    const budgetPage = new BudgetPage(page)
    await budgetPage.goto()
  })

  test('deve exibir a página de orçamento', async ({ page }) => {
    await expect(page.locator('h1:has-text("Orçamento")')).toBeVisible()
  })

  test('deve exibir mês atual', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    const currentMonth = await budgetPage.getCurrentMonth()
    // Should show month name
    expect(currentMonth).toBeTruthy()
  })

  test('deve exibir botão de adicionar', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    await expect(budgetPage.addButton.first()).toBeVisible()
  })

  test('deve navegar entre meses', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    const initialMonth = await budgetPage.getCurrentMonth()

    await budgetPage.previousMonth()
    await waitForPageStable(page)

    const prevMonth = await budgetPage.getCurrentMonth()
    // Month should have changed
    expect(prevMonth).not.toBe(initialMonth)

    await budgetPage.nextMonth()
    await waitForPageStable(page)
  })

  test('deve abrir modal ao clicar em adicionar', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    await budgetPage.clickAdd()

    await expect(budgetPage.modal).toBeVisible()
  })

  test('deve ter seletor de categoria no modal', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    await budgetPage.clickAdd()

    await expect(budgetPage.categorySelect).toBeVisible()
  })

  test('deve adicionar item de orçamento', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    await budgetPage.addBudgetItem({
      category: TEST_BUDGET_ITEM.category,
      planned: TEST_BUDGET_ITEM.planned,
    })

    // Modal should close
    await expect(budgetPage.modal).not.toBeVisible()

    // Item should appear
    await budgetPage.assertBudgetItemExists(TEST_BUDGET_ITEM.category)
  })

  test('deve exibir progresso do orçamento', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    const itemExists = await budgetPage.budgetItemExists(TEST_BUDGET_ITEM.category)

    if (itemExists) {
      const progress = await budgetPage.getBudgetProgress(TEST_BUDGET_ITEM.category)
      // Should have planned value
      expect(progress.planned).toBeTruthy()
    }
  })

  test('deve excluir item de orçamento', async ({ page }) => {
    const budgetPage = new BudgetPage(page)

    // Check if item exists
    let categoryName = TEST_BUDGET_ITEM.category
    if (!(await budgetPage.budgetItemExists(categoryName))) {
      // Create it first
      await budgetPage.addBudgetItem({
        category: categoryName,
        planned: TEST_BUDGET_ITEM.planned,
      })
    }

    // Delete item
    await budgetPage.deleteItem(categoryName)

    await page.waitForTimeout(500)
    await budgetPage.assertBudgetItemNotExists(categoryName)
  })

  test('screenshot orçamento desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`budget-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Orçamento - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/budget')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Orçamento")')).toBeVisible()
  })

  test('screenshot orçamento mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`budget-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
