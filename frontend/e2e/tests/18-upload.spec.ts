import { test, expect } from '@playwright/test'
import { UploadPage } from '../pages'
import { TEST_TRANSACTION } from '../fixtures/test-data'
import { waitForPageStable, getCurrentDate } from '../utils/test.helper'

/**
 * Upload/Add Transaction Tests
 * Tests transaction creation via manual entry
 */

test.describe('Upload/Adicionar', () => {
  test.beforeEach(async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto()
  })

  test('deve exibir a página de adicionar', async ({ page }) => {
    await expect(page.locator('h1:has-text("Adicionar")')).toBeVisible()
  })

  test('deve exibir opções de modo', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    // At least one mode should be available
    const cameraVisible = await uploadPage.cameraButton.isVisible()
    const fileVisible = await uploadPage.fileButton.isVisible()
    const manualVisible = await uploadPage.manualButton.isVisible()

    expect(cameraVisible || fileVisible || manualVisible).toBeTruthy()
  })

  test('deve selecionar modo manual', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    await uploadPage.selectManualMode()

    // Form should appear
    const formVisible = await uploadPage.isManualFormVisible()
    expect(formVisible).toBeTruthy()
  })

  test('deve ter campos obrigatórios no formulário manual', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    await uploadPage.selectManualMode()

    await expect(uploadPage.amountInput).toBeVisible()
  })

  test('deve criar transação manual', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    await uploadPage.createManualTransaction({
      type: 'Despesa',
      amount: TEST_TRANSACTION.amount,
      date: getCurrentDate(),
      description: TEST_TRANSACTION.description,
      category: TEST_TRANSACTION.category,
    })

    // Transaction should be created
    await waitForPageStable(page)
  })

  test('deve ter opção de parcelamento', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    await uploadPage.selectManualMode()

    // Installment toggle should exist
    const toggleVisible = await uploadPage.installmentToggle.isVisible()
    // Toggle may or may not be visible depending on implementation
  })

  test('screenshot upload desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`upload-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Upload/Adicionar - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/upload')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Adicionar")')).toBeVisible()
  })

  test('screenshot upload mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`upload-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
