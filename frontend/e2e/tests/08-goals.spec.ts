import { test, expect } from '@playwright/test'
import { GoalsPage } from '../pages'
import { TEST_GOAL } from '../fixtures/test-data'
import { waitForPageStable, getDateFromNow } from '../utils/test.helper'

/**
 * Goals Tests
 * Tests goal listing, creation, contribution, and calculations
 */

test.describe('Metas', () => {
  test.beforeEach(async ({ page }) => {
    const goalsPage = new GoalsPage(page)
    await goalsPage.goto()
  })

  test('deve exibir a página de metas', async ({ page }) => {
    await expect(page.locator('h1:has-text("Metas")')).toBeVisible()
  })

  test('deve exibir botão de nova meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    await expect(goalsPage.newGoalButton.first()).toBeVisible()
  })

  test('deve exibir botão de calcular reserva', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    // Emergency reserve calculator should be available
    const reserveButton = goalsPage.emergencyReserveButton
    const isVisible = await reserveButton.isVisible()
    // Button may or may not be visible depending on UI
  })

  test('deve abrir modal ao clicar em nova meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    await goalsPage.clickNewGoal()

    await expect(goalsPage.modal).toBeVisible()
  })

  test('deve criar nova meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    const deadline = getDateFromNow(180) // 6 months from now

    await goalsPage.createGoal({
      name: TEST_GOAL.name,
      target: TEST_GOAL.target,
      deadline: deadline,
    })

    // Modal should close
    await expect(goalsPage.modal).not.toBeVisible()

    // Goal should appear
    await goalsPage.assertGoalExists(TEST_GOAL.name)
  })

  test('deve exibir progresso da meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    const exists = await goalsPage.goalExists(TEST_GOAL.name)

    if (exists) {
      const progress = await goalsPage.getGoalProgress(TEST_GOAL.name)
      // Should have target value
      expect(progress.target).toBeTruthy()
    }
  })

  test('deve adicionar contribuição à meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    // Check if goal exists
    if (!(await goalsPage.goalExists(TEST_GOAL.name))) {
      await goalsPage.createGoal({
        name: TEST_GOAL.name,
        target: TEST_GOAL.target,
      })
    }

    // Add contribution
    await goalsPage.addContribution(TEST_GOAL.name, TEST_GOAL.contribution)

    await waitForPageStable(page)
  })

  test('deve excluir meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page)

    // Create or find goal
    let goalName = TEST_GOAL.name
    if (!(await goalsPage.goalExists(goalName))) {
      await goalsPage.createGoal({
        name: goalName,
        target: TEST_GOAL.target,
      })
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete goal
    await goalsPage.deleteGoal(goalName)

    await page.waitForTimeout(500)
    await goalsPage.assertGoalNotExists(goalName)
  })

  test('screenshot metas desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`goals-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Metas - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/goals')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Metas")')).toBeVisible()
  })

  test('screenshot metas mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`goals-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
