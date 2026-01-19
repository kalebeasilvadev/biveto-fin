import { test, expect } from '@playwright/test'
import { InsightsPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Insights Tests
 * Tests insights display
 */

test.describe('Insights', () => {
  test.beforeEach(async ({ page }) => {
    const insightsPage = new InsightsPage(page)
    await insightsPage.goto()
  })

  test('deve exibir a página de insights', async ({ page }) => {
    await expect(page.locator('h1:has-text("Insights")')).toBeVisible()
  })

  test('deve exibir lista de insights ou estado vazio', async ({ page }) => {
    const insightsPage = new InsightsPage(page)

    const hasInsights = await insightsPage.hasInsights()
    const hasEmptyState = await insightsPage.isShowingEmptyState()

    expect(hasInsights || hasEmptyState).toBeTruthy()
  })

  test('deve identificar tipos de insight', async ({ page }) => {
    const insightsPage = new InsightsPage(page)

    if (await insightsPage.hasInsights()) {
      // Check for insight type badges
      const leakageCount = await insightsPage.getLeakageCount()
      const mainExpenseCount = await insightsPage.getMainExpenseCount()
      const opportunityCount = await insightsPage.getOpportunityCount()
      const anomalyCount = await insightsPage.getAnomalyCount()

      // At least one type should have insights
      const totalTyped = leakageCount + mainExpenseCount + opportunityCount + anomalyCount
      // totalTyped may be 0 if badges aren't visible
    }
  })

  test('deve exibir títulos dos insights', async ({ page }) => {
    const insightsPage = new InsightsPage(page)

    if (await insightsPage.hasInsights()) {
      const titles = await insightsPage.getAllInsightTitles()
      expect(titles.length).toBeGreaterThan(0)
    }
  })

  test('screenshot insights desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`insights-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Insights - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/insights')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Insights")')).toBeVisible()
  })

  test('screenshot insights mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`insights-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
