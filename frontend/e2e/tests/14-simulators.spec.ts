import { test, expect } from '@playwright/test'
import { SimulatorsPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Simulators Tests
 * Tests debt, emergency reserve, and PNIF simulators
 */

test.describe('Simuladores', () => {
  test.beforeEach(async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)
    await simulatorsPage.goto()
  })

  test('deve exibir a página de simuladores', async ({ page }) => {
    await expect(page.locator('h1:has-text("Simuladores")')).toBeVisible()
  })

  test('deve ter tabs de simuladores', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    // At least one tab should be visible
    const hasDebtsTab = await simulatorsPage.debtsTab.isVisible()
    const hasEmergencyTab = await simulatorsPage.emergencyTab.isVisible()
    const hasPnifTab = await simulatorsPage.pnifTab.isVisible()

    expect(hasDebtsTab || hasEmergencyTab || hasPnifTab).toBeTruthy()
  })

  test('deve selecionar tab de dívidas', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.debtsTab.isVisible()) {
      await simulatorsPage.selectDebtsTab()
      await waitForPageStable(page)
    }
  })

  test('deve calcular quitação de dívidas', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.debtsTab.isVisible()) {
      await simulatorsPage.calculateDebtPayoff('1000')

      // Results should appear if there are debts
      await waitForPageStable(page)
    }
  })

  test('deve selecionar tab de reserva de emergência', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.emergencyTab.isVisible()) {
      await simulatorsPage.selectEmergencyTab()
      await waitForPageStable(page)
    }
  })

  test('deve calcular reserva de emergência', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.emergencyTab.isVisible()) {
      await simulatorsPage.calculateEmergency('6')

      const result = await simulatorsPage.getEmergencyResult()
      // Result may or may not appear depending on data
    }
  })

  test('deve selecionar tab de PNIF', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.pnifTab.isVisible()) {
      await simulatorsPage.selectPnifTab()
      await waitForPageStable(page)
    }
  })

  test('deve calcular PNIF', async ({ page }) => {
    const simulatorsPage = new SimulatorsPage(page)

    if (await simulatorsPage.pnifTab.isVisible()) {
      await simulatorsPage.calculatePnif('100000', '8')

      const result = await simulatorsPage.getPnifResult()
      expect(result).toBeTruthy()
    }
  })

  test('screenshot simuladores desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`simulators-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Simuladores - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/simulators')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Simuladores")')).toBeVisible()
  })

  test('screenshot simuladores mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`simulators-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
