import { test, expect } from '@playwright/test'
import { FamilyPage } from '../pages'
import { TEST_FAMILY } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Family Tests
 * Tests family member management
 */

test.describe('Família', () => {
  test.beforeEach(async ({ page }) => {
    const familyPage = new FamilyPage(page)
    await familyPage.goto()
  })

  test('deve exibir a página de família', async ({ page }) => {
    await expect(page.locator('h1:has-text("Família")')).toBeVisible()
  })

  test('deve exibir informações do plano', async ({ page }) => {
    const familyPage = new FamilyPage(page)

    // Plan card should be visible
    const memberCount = await familyPage.getMemberCount()
    const maxMembers = await familyPage.getMaxMembers()

    // Should have at least the current user
    expect(memberCount).toBeGreaterThanOrEqual(1)
  })

  test('deve exibir lista de membros', async ({ page }) => {
    const familyPage = new FamilyPage(page)

    // Members list should be visible
    await expect(familyPage.membersList).toBeVisible()
  })

  test('deve exibir botão de convidar se permitido', async ({ page }) => {
    const familyPage = new FamilyPage(page)

    const canAdd = await familyPage.canAddMoreMembers()

    if (canAdd) {
      await expect(familyPage.inviteButton).toBeVisible()
    }
  })

  test('deve abrir modal de convite', async ({ page }) => {
    const familyPage = new FamilyPage(page)

    if (await familyPage.inviteButton.isVisible()) {
      await familyPage.clickInvite()

      await expect(familyPage.inviteModal).toBeVisible()
    }
  })

  test('deve ter campo de email no modal de convite', async ({ page }) => {
    const familyPage = new FamilyPage(page)

    if (await familyPage.inviteButton.isVisible()) {
      await familyPage.clickInvite()

      await expect(familyPage.emailInput).toBeVisible()
    }
  })

  test('screenshot família desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`family-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Família - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/family')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Família")')).toBeVisible()
  })

  test('screenshot família mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`family-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
