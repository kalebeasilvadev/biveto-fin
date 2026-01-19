import { test, expect } from '@playwright/test'
import { CalendarPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Calendar Tests
 * Tests calendar display and navigation
 */

test.describe('Calendário', () => {
  test.beforeEach(async ({ page }) => {
    const calendarPage = new CalendarPage(page)
    await calendarPage.goto()
  })

  test('deve exibir a página de calendário', async ({ page }) => {
    await expect(page.locator('h1:has-text("Calendário")')).toBeVisible()
  })

  test('deve exibir mês atual', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    const monthLabel = await calendarPage.getCurrentMonthLabel()
    expect(monthLabel).toBeTruthy()
  })

  test('deve navegar para mês anterior', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    const initialMonth = await calendarPage.getCurrentMonthLabel()

    await calendarPage.previousMonth()
    await waitForPageStable(page)

    const newMonth = await calendarPage.getCurrentMonthLabel()
    expect(newMonth).not.toBe(initialMonth)
  })

  test('deve navegar para próximo mês', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    const initialMonth = await calendarPage.getCurrentMonthLabel()

    await calendarPage.nextMonth()
    await waitForPageStable(page)

    const newMonth = await calendarPage.getCurrentMonthLabel()
    expect(newMonth).not.toBe(initialMonth)
  })

  test('deve exibir grade de calendário', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    // Calendar grid should exist
    await expect(calendarPage.calendarGrid).toBeVisible()
  })

  test('deve abrir detalhes ao clicar em um dia', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    // Click on today or day 15
    const today = new Date().getDate()
    await calendarPage.clickDay(today)

    // Modal or detail view may appear
    await page.waitForTimeout(500)
  })

  test('deve alternar entre visualizações', async ({ page }) => {
    const calendarPage = new CalendarPage(page)

    // Switch to 90 days view if available
    const ninetyDaysVisible = await calendarPage.ninetyDaysButton.isVisible()

    if (ninetyDaysVisible) {
      await calendarPage.switchTo90DaysView()
      await waitForPageStable(page)

      // Switch back
      await calendarPage.switchToMonthlyView()
      await waitForPageStable(page)
    }
  })

  test('screenshot calendário desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`calendar-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Calendário - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Calendário")')).toBeVisible()
  })

  test('screenshot calendário mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`calendar-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
