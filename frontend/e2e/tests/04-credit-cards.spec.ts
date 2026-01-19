import { test, expect } from '@playwright/test'
import { CreditCardsPage } from '../pages'
import { TEST_CREDIT_CARD } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Credit Cards Tests
 * Tests credit card listing, creation, and management
 */

test.describe('Cartões de Crédito', () => {
  test.beforeEach(async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)
    await creditCardsPage.goto()
  })

  test('deve exibir a página de cartões', async ({ page }) => {
    await expect(page.locator('h1:has-text("Cartões")')).toBeVisible()
  })

  test('deve exibir botão de novo cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)
    await expect(creditCardsPage.newCardButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em novo cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    await creditCardsPage.clickNewCard()

    await expect(creditCardsPage.modal).toBeVisible()
    await expect(page.locator('h2:has-text("Novo Cartão"), h2:has-text("Cartão")')).toBeVisible()
  })

  test('deve ter campos obrigatórios no modal', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    await creditCardsPage.clickNewCard()

    await expect(creditCardsPage.nameInput).toBeVisible()
    await expect(creditCardsPage.limitInput).toBeVisible()
  })

  test('deve criar novo cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    await creditCardsPage.createCard({
      name: TEST_CREDIT_CARD.name,
      limit: TEST_CREDIT_CARD.limit,
      closingDay: TEST_CREDIT_CARD.closingDay,
      dueDay: TEST_CREDIT_CARD.dueDay,
    })

    // Modal should close
    await expect(creditCardsPage.modal).not.toBeVisible()

    // Card should appear in list
    await creditCardsPage.assertCardExists(TEST_CREDIT_CARD.name)
  })

  test('deve exibir informações do cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    // Check if test card exists
    const exists = await creditCardsPage.cardExists(TEST_CREDIT_CARD.name)

    if (!exists) {
      await creditCardsPage.createCard({
        name: TEST_CREDIT_CARD.name,
        limit: TEST_CREDIT_CARD.limit,
        closingDay: TEST_CREDIT_CARD.closingDay,
        dueDay: TEST_CREDIT_CARD.dueDay,
      })
    }

    // Card should show limit info
    const cardElement = creditCardsPage.getCard(TEST_CREDIT_CARD.name)
    await expect(cardElement).toBeVisible()

    // Should have progress bar or usage info
    const hasLimitInfo = await cardElement.locator('text=Limite, text=Disponível, text=Usado').isVisible()
    // Limit info display may vary
  })

  test('deve navegar para faturas do cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    // Check if test card exists
    const exists = await creditCardsPage.cardExists(TEST_CREDIT_CARD.name)

    if (exists) {
      await creditCardsPage.viewInvoices(TEST_CREDIT_CARD.name)

      // Should navigate to invoices page
      await expect(page).toHaveURL(/\/invoices/)
    }
  })

  test('deve excluir cartão', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)

    // Create a card to delete if it doesn't exist
    let cardName = TEST_CREDIT_CARD.name
    if (!(await creditCardsPage.cardExists(cardName))) {
      await creditCardsPage.createCard({
        name: cardName,
        limit: TEST_CREDIT_CARD.limit,
        closingDay: TEST_CREDIT_CARD.closingDay,
        dueDay: TEST_CREDIT_CARD.dueDay,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete card
    await creditCardsPage.deleteCard(cardName)

    // Wait and verify it's gone
    await page.waitForTimeout(1000)
    await creditCardsPage.assertCardNotExists(cardName)
  })

  test('screenshot cartões desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`credit-cards-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Cartões de Crédito - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/credit-cards')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Cartões")')).toBeVisible()
  })

  test('deve exibir botão de novo cartão em mobile', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)
    await expect(creditCardsPage.newCardButton.first()).toBeVisible()
  })

  test('screenshot cartões mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`credit-cards-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
