import { test, expect } from '@playwright/test'
import { RecurringPage } from '../pages'
import { TEST_RECURRING } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Recurring Transactions Tests
 * Tests recurring transaction listing, creation, and management
 */

test.describe('Recorrentes', () => {
  test.beforeEach(async ({ page }) => {
    const recurringPage = new RecurringPage(page)
    await recurringPage.goto()
  })

  test('deve exibir a página de recorrentes', async ({ page }) => {
    await expect(page.locator('h1:has-text("Recorrentes"), h1:has-text("Transações Recorrentes")')).toBeVisible()
  })

  test('deve exibir botão de adicionar', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    await expect(recurringPage.addButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em adicionar', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    await recurringPage.clickAdd()

    await expect(recurringPage.modal).toBeVisible()
  })

  test('deve criar transação recorrente', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    await recurringPage.createRecurring({
      name: TEST_RECURRING.name,
      amount: TEST_RECURRING.amount,
      type: 'Despesa',
      frequency: 'Mensal',
      day: TEST_RECURRING.day,
    })

    // Modal should close
    await expect(recurringPage.modal).not.toBeVisible()

    // Recurring should appear
    await recurringPage.assertRecurringExists(TEST_RECURRING.name)
  })

  test('deve pausar e retomar recorrente', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    // Check if recurring exists
    if (!(await recurringPage.recurringExists(TEST_RECURRING.name))) {
      await recurringPage.createRecurring({
        name: TEST_RECURRING.name,
        amount: TEST_RECURRING.amount,
      })
    }

    // Toggle pause
    await recurringPage.togglePause(TEST_RECURRING.name)
    await waitForPageStable(page)

    // Toggle again to resume
    await recurringPage.togglePause(TEST_RECURRING.name)
    await waitForPageStable(page)
  })

  test('deve editar recorrente', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    // Check if recurring exists
    if (!(await recurringPage.recurringExists(TEST_RECURRING.name))) {
      await recurringPage.createRecurring({
        name: TEST_RECURRING.name,
        amount: TEST_RECURRING.amount,
      })
    }

    // Click edit
    await recurringPage.clickEdit(TEST_RECURRING.name)

    // Modal should open
    await expect(recurringPage.modal).toBeVisible()

    // Change amount
    await recurringPage.fillAmount(TEST_RECURRING.amountEdited)
    await recurringPage.save()

    await waitForPageStable(page)
  })

  test('deve excluir recorrente', async ({ page }) => {
    const recurringPage = new RecurringPage(page)

    // Create or find recurring
    let recurringName = TEST_RECURRING.name
    if (!(await recurringPage.recurringExists(recurringName))) {
      await recurringPage.createRecurring({
        name: recurringName,
        amount: TEST_RECURRING.amount,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete recurring
    await recurringPage.deleteRecurring(recurringName)

    await page.waitForTimeout(500)
    await recurringPage.assertRecurringNotExists(recurringName)
  })

  test('screenshot recorrentes desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`recurring-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Recorrentes - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/recurring')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Recorrentes"), h1:has-text("Transações Recorrentes")')).toBeVisible()
  })

  test('screenshot recorrentes mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`recurring-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
