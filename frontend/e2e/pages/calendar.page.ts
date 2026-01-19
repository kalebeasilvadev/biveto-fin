import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Calendar Page Object
 */
export class CalendarPage extends BasePage {
  // Navigation
  readonly prevMonthButton: Locator
  readonly nextMonthButton: Locator
  readonly currentMonthLabel: Locator

  // View toggles
  readonly monthViewButton: Locator
  readonly ninetyDaysButton: Locator

  // Calendar grid
  readonly calendarGrid: Locator
  readonly daysCells: Locator
  readonly todayCell: Locator

  // Day detail modal
  readonly dayModal: Locator
  readonly transactionsList: Locator

  // Projections
  readonly projectedBalance: Locator

  constructor(page: Page) {
    super(page, '/calendar')

    // Navigation
    this.prevMonthButton = page.locator('button:has(svg[class*="chevron-left"])')
    this.nextMonthButton = page.locator('button:has(svg[class*="chevron-right"])')
    this.currentMonthLabel = page.locator('.text-xl.font-bold, h2')

    // View toggles
    this.monthViewButton = page.locator('button:has-text("Mensal")')
    this.ninetyDaysButton = page.locator('button:has-text("90 dias")')

    // Calendar grid
    this.calendarGrid = page.locator('.calendar-grid, .grid')
    this.daysCells = page.locator('.calendar-day, .grid > div')
    this.todayCell = page.locator('.today, .bg-primary-')

    // Day detail modal
    this.dayModal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.transactionsList = page.locator('.modal .divide-y, .modal .space-y-2')

    // Projections
    this.projectedBalance = page.locator('text=Saldo Projetado').locator('..')
  }

  /**
   * Navigate to previous month
   */
  async previousMonth() {
    await this.prevMonthButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Navigate to next month
   */
  async nextMonth() {
    await this.nextMonthButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get current month label
   */
  async getCurrentMonthLabel(): Promise<string> {
    const text = await this.currentMonthLabel.textContent()
    return text || ''
  }

  /**
   * Switch to monthly view
   */
  async switchToMonthlyView() {
    await this.monthViewButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Switch to 90 days view
   */
  async switchTo90DaysView() {
    await this.ninetyDaysButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click on a specific day
   */
  async clickDay(dayNumber: number) {
    const dayCell = this.page.locator(`.calendar-day:has-text("${dayNumber}"), .grid > div:has-text("${dayNumber}")`).first()
    await dayCell.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click on today
   */
  async clickToday() {
    await this.todayCell.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if day has transactions
   */
  async dayHasTransactions(dayNumber: number): Promise<boolean> {
    const dayCell = this.page.locator(`.calendar-day:has-text("${dayNumber}"), .grid > div:has-text("${dayNumber}")`).first()
    return dayCell.locator('.indicator, .dot, .badge').isVisible()
  }

  /**
   * Get day transactions count indicator
   */
  async getDayTransactionCount(dayNumber: number): Promise<number> {
    const dayCell = this.page.locator(`.calendar-day:has-text("${dayNumber}")`).first()
    const badge = dayCell.locator('.badge, .count')
    if (await badge.isVisible()) {
      const text = await badge.textContent()
      return parseInt(text || '0', 10)
    }
    return 0
  }

  /**
   * Get day detail transactions
   */
  async getDayTransactions(): Promise<string[]> {
    await expect(this.dayModal).toBeVisible()
    const transactions = this.transactionsList.locator('> div')
    return transactions.allTextContents()
  }

  /**
   * Close day modal
   */
  async closeDayModal() {
    const closeButton = this.page.locator('button:has(svg[class*="x"])').first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Get projected balance
   */
  async getProjectedBalance(): Promise<string> {
    const text = await this.projectedBalance.locator('.font-bold, .text-2xl').textContent()
    return text || ''
  }

  /**
   * Check if in monthly view
   */
  async isMonthlyView(): Promise<boolean> {
    return this.monthViewButton.locator('.active, [aria-pressed="true"]').isVisible()
  }

  /**
   * Check if in 90 days view
   */
  async is90DaysView(): Promise<boolean> {
    return this.ninetyDaysButton.locator('.active, [aria-pressed="true"]').isVisible()
  }

  /**
   * Get all days with indicators
   */
  async getDaysWithTransactions(): Promise<number[]> {
    const days: number[] = []
    const cells = this.page.locator('.calendar-day:has(.indicator)')
    const count = await cells.count()

    for (let i = 0; i < count; i++) {
      const text = await cells.nth(i).textContent()
      const dayNumber = parseInt(text?.match(/\d+/)?.[0] || '0', 10)
      if (dayNumber > 0) {
        days.push(dayNumber)
      }
    }

    return days
  }

  /**
   * Navigate to specific month
   */
  async goToMonth(targetMonth: string) {
    let currentMonth = await this.getCurrentMonthLabel()
    let attempts = 0
    const maxAttempts = 24 // Max 2 years

    while (!currentMonth.toLowerCase().includes(targetMonth.toLowerCase()) && attempts < maxAttempts) {
      await this.nextMonth()
      currentMonth = await this.getCurrentMonthLabel()
      attempts++
    }
  }

  /**
   * Assert day has transactions
   */
  async assertDayHasTransactions(dayNumber: number) {
    const hasTransactions = await this.dayHasTransactions(dayNumber)
    expect(hasTransactions).toBe(true)
  }

  /**
   * Assert day modal is visible
   */
  async assertDayModalVisible() {
    await expect(this.dayModal).toBeVisible()
  }
}
