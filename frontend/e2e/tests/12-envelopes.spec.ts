import { test, expect } from '@playwright/test'
import { EnvelopesPage } from '../pages'
import { TEST_ENVELOPE } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Envelopes Tests
 * Tests envelope listing, creation, and transfer
 */

test.describe('Envelopes', () => {
  test.beforeEach(async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)
    await envelopesPage.goto()
  })

  test('deve exibir a página de envelopes', async ({ page }) => {
    await expect(page.locator('h1:has-text("Envelopes")')).toBeVisible()
  })

  test('deve exibir botão de novo envelope', async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)

    await expect(envelopesPage.newEnvelopeButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em novo envelope', async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)

    await envelopesPage.clickNewEnvelope()

    await expect(envelopesPage.modal).toBeVisible()
  })

  test('deve criar novo envelope', async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)

    await envelopesPage.createEnvelope({
      name: TEST_ENVELOPE.name,
      limit: TEST_ENVELOPE.limit,
      period: 'Mensal',
      allowRollover: TEST_ENVELOPE.allowRollover,
    })

    // Modal should close
    await expect(envelopesPage.modal).not.toBeVisible()

    // Envelope should appear
    await envelopesPage.assertEnvelopeExists(TEST_ENVELOPE.name)
  })

  test('deve exibir limite e saldo do envelope', async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)

    const exists = await envelopesPage.envelopeExists(TEST_ENVELOPE.name)

    if (exists) {
      const balance = await envelopesPage.getEnvelopeBalance(TEST_ENVELOPE.name)
      // Should have balance info
      expect(balance).toBeTruthy()
    }
  })

  test('deve excluir envelope', async ({ page }) => {
    const envelopesPage = new EnvelopesPage(page)

    // Create or find envelope
    let envelopeName = TEST_ENVELOPE.name
    if (!(await envelopesPage.envelopeExists(envelopeName))) {
      await envelopesPage.createEnvelope({
        name: envelopeName,
        limit: TEST_ENVELOPE.limit,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete envelope
    await envelopesPage.deleteEnvelope(envelopeName)

    await page.waitForTimeout(500)
    await envelopesPage.assertEnvelopeNotExists(envelopeName)
  })

  test('screenshot envelopes desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`envelopes-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Envelopes - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/envelopes')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Envelopes")')).toBeVisible()
  })

  test('screenshot envelopes mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`envelopes-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
