import { test, expect } from '@playwright/test'
import { AutomationsPage } from '../pages'
import { TEST_AUTOMATION } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Automations Tests
 * Tests automation listing, creation, and management
 */

test.describe('Automações', () => {
  test.beforeEach(async ({ page }) => {
    const automationsPage = new AutomationsPage(page)
    await automationsPage.goto()
  })

  test('deve exibir a página de automações', async ({ page }) => {
    await expect(page.locator('h1:has-text("Automações")')).toBeVisible()
  })

  test('deve exibir botão de nova automação', async ({ page }) => {
    const automationsPage = new AutomationsPage(page)

    await expect(automationsPage.newAutomationButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em nova automação', async ({ page }) => {
    const automationsPage = new AutomationsPage(page)

    await automationsPage.clickNewAutomation()

    await expect(automationsPage.modal).toBeVisible()
  })

  test('deve criar nova automação', async ({ page }) => {
    const automationsPage = new AutomationsPage(page)

    await automationsPage.createAutomation({
      name: TEST_AUTOMATION.name,
      amount: TEST_AUTOMATION.amount,
    })

    // Modal should close
    await expect(automationsPage.modal).not.toBeVisible()

    // Automation should appear
    await automationsPage.assertAutomationExists(TEST_AUTOMATION.name)
  })

  test('deve ativar/desativar automação', async ({ page }) => {
    const automationsPage = new AutomationsPage(page)

    // Check if automation exists
    if (!(await automationsPage.automationExists(TEST_AUTOMATION.name))) {
      await automationsPage.createAutomation({
        name: TEST_AUTOMATION.name,
        amount: TEST_AUTOMATION.amount,
      })
    }

    // Toggle activation
    await automationsPage.toggleActivation(TEST_AUTOMATION.name)
    await waitForPageStable(page)

    // Toggle again
    await automationsPage.toggleActivation(TEST_AUTOMATION.name)
    await waitForPageStable(page)
  })

  test('deve excluir automação', async ({ page }) => {
    const automationsPage = new AutomationsPage(page)

    // Create or find automation
    let automationName = TEST_AUTOMATION.name
    if (!(await automationsPage.automationExists(automationName))) {
      await automationsPage.createAutomation({
        name: automationName,
        amount: TEST_AUTOMATION.amount,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete automation
    await automationsPage.deleteAutomation(automationName)

    await page.waitForTimeout(500)
    await automationsPage.assertAutomationNotExists(automationName)
  })

  test('screenshot automações desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`automations-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Automações - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/automations')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Automações")')).toBeVisible()
  })

  test('screenshot automações mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`automations-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
