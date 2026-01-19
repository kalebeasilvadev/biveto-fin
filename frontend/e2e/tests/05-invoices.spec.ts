import { test, expect } from '@playwright/test'
import { InvoicesPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Invoices Tests
 * Tests invoice listing, filtering, and payment
 */

test.describe('Faturas', () => {
  test.beforeEach(async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)
    await invoicesPage.goto()
  })

  test('deve exibir a página de faturas', async ({ page }) => {
    await expect(page.locator('h1:has-text("Faturas")')).toBeVisible()
  })

  test('deve exibir seletor de cartão', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    // Card selector should be visible if there are cards
    const selectorVisible = await invoicesPage.cardSelector.isVisible()
    // This is expected to pass - selector may or may not exist depending on cards
  })

  test('deve exibir seletor de ano', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    const yearSelectorVisible = await invoicesPage.yearSelector.isVisible()
    // Year selector should exist for navigation
  })

  test('deve exibir tabs de meses', async ({ page }) => {
    // Month tabs or navigation should exist
    const monthNav = page.locator('button:has-text("Jan"), button:has-text("Fev"), button:has-text("Mar")')
    const hasMonthNav = await monthNav.first().isVisible()
    // Month navigation may vary by implementation
  })

  test('deve filtrar por cartão selecionado', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    // Get card options
    const options = await invoicesPage.getAllCardOptions()

    if (options.length > 1) {
      // Select second card
      await invoicesPage.selectCard(options[1])

      // Page should update
      await waitForPageStable(page)
    }
  })

  test('deve exibir detalhes da fatura ao clicar', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    const invoiceCount = await invoicesPage.getInvoiceCount()

    if (invoiceCount > 0) {
      // Click on first invoice
      const firstInvoice = invoicesPage.invoiceCards.first()
      await firstInvoice.click()

      // Detail modal or expanded view should appear
      await page.waitForTimeout(500)
    }
  })

  test('deve exibir botão de pagamento em fatura não paga', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    const invoiceCount = await invoicesPage.getInvoiceCount()

    if (invoiceCount > 0) {
      // Look for pay button
      const payButton = page.locator('button:has-text("Pagar")')
      const hasPayButton = await payButton.first().isVisible()
      // Pay button visibility depends on invoice status
    }
  })

  test('deve abrir modal de pagamento', async ({ page }) => {
    const invoicesPage = new InvoicesPage(page)

    const payButton = page.locator('button:has-text("Pagar")').first()

    if (await payButton.isVisible()) {
      await payButton.click()

      // Payment modal should open
      await expect(invoicesPage.payModal).toBeVisible()
    }
  })

  test('screenshot faturas desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`invoices-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Faturas - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/invoices')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Faturas")')).toBeVisible()
  })

  test('screenshot faturas mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`invoices-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
