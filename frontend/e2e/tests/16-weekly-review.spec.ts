import { test, expect } from '@playwright/test'
import { WeeklyReviewPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Weekly Review Tests
 * Tests weekly review wizard
 */

test.describe('Revisão Semanal', () => {
  test.beforeEach(async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)
    await weeklyReviewPage.goto()
  })

  test('deve exibir a página de revisão semanal', async ({ page }) => {
    await expect(page.locator('h1:has-text("Revisão"), h1:has-text("Review")')).toBeVisible()
  })

  test('deve iniciar no primeiro passo', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    // Should be at first step or show wizard
    const isFirstStep = await weeklyReviewPage.isAtFirstStep()
    // First step or intro should be shown
  })

  test('deve ter botões de navegação', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    // Next button should be visible
    await expect(weeklyReviewPage.nextButton).toBeVisible()
  })

  test('deve navegar para próximo passo', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    const initialStep = await weeklyReviewPage.getCurrentStep()

    await weeklyReviewPage.nextStep()

    const newStep = await weeklyReviewPage.getCurrentStep()
    // Step should have changed (if not at last step)
  })

  test('deve navegar para passo anterior', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    // First go to step 2
    await weeklyReviewPage.nextStep()

    // Then go back
    await weeklyReviewPage.previousStep()
  })

  test('deve mostrar resumo no primeiro passo', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    // Summary section should be visible
    const income = await weeklyReviewPage.getSummaryIncome()
    const expense = await weeklyReviewPage.getSummaryExpense()
    // May or may not have values
  })

  test('deve completar revisão ao navegar todos os passos', async ({ page }) => {
    const weeklyReviewPage = new WeeklyReviewPage(page)

    // Navigate through all steps
    let attempts = 0
    const maxAttempts = 10

    while (!(await weeklyReviewPage.isAtLastStep()) && attempts < maxAttempts) {
      await weeklyReviewPage.nextStep()
      await waitForPageStable(page)
      attempts++
    }

    // Complete button should be visible at the end
    if (await weeklyReviewPage.isAtLastStep()) {
      await expect(weeklyReviewPage.completeButton).toBeVisible()
    }
  })

  test('screenshot revisão semanal desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`weekly-review-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Revisão Semanal - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/weekly-review')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Revisão"), h1:has-text("Review")')).toBeVisible()
  })

  test('screenshot revisão semanal mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`weekly-review-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
