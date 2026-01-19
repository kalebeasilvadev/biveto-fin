import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Dashboard Page Object
 */
export class DashboardPage extends BasePage {
  // Summary cards
  readonly incomeCard: Locator
  readonly expenseCard: Locator
  readonly pendingCard: Locator
  readonly balanceCard: Locator

  // Chart
  readonly categoryChart: Locator

  // Top expenses
  readonly topExpensesList: Locator

  constructor(page: Page) {
    super(page, '/')

    this.incomeCard = page.locator('.card:has-text("Receitas")').first()
    this.expenseCard = page.locator('.card:has-text("Despesas")').first()
    this.pendingCard = page.locator('.card:has-text("pagar")').first()
    this.balanceCard = page.locator('.card:has-text("Saldo")').first()
    this.categoryChart = page.locator('.recharts-responsive-container').first()
    this.topExpensesList = page.locator('text=Maiores Gastos').locator('..')
  }

  /**
   * Get income value
   */
  async getIncomeValue(): Promise<string> {
    const text = await this.incomeCard.locator('.font-bold').textContent()
    return text || ''
  }

  /**
   * Get expense value
   */
  async getExpenseValue(): Promise<string> {
    const text = await this.expenseCard.locator('.font-bold').textContent()
    return text || ''
  }

  /**
   * Get pending value
   */
  async getPendingValue(): Promise<string> {
    const text = await this.pendingCard.locator('.font-bold').textContent()
    return text || ''
  }

  /**
   * Get balance value
   */
  async getBalanceValue(): Promise<string> {
    const text = await this.balanceCard.locator('.font-bold').textContent()
    return text || ''
  }

  /**
   * Check if summary cards are visible
   */
  async areSummaryCardsVisible(): Promise<boolean> {
    const cards = await this.page.locator('.card').count()
    return cards >= 4
  }

  /**
   * Check if chart is visible
   */
  async isChartVisible(): Promise<boolean> {
    return this.categoryChart.isVisible()
  }

  /**
   * Get expense variation text
   */
  async getExpenseVariation(): Promise<string | null> {
    const variation = this.expenseCard.locator('.text-red-500, .text-green-500')
    if (await variation.isVisible()) {
      return variation.textContent()
    }
    return null
  }

  /**
   * Navigate to transactions via menu
   */
  async goToTransactions() {
    await this.navigateTo('Transações')
  }

  /**
   * Navigate to accounts via menu
   */
  async goToAccounts() {
    await this.navigateTo('Contas')
  }

  /**
   * Navigate to credit cards via menu
   */
  async goToCreditCards() {
    await this.navigateTo('Cartões')
  }

  /**
   * Assert all summary cards are present
   */
  async assertSummaryCardsPresent() {
    await expect(this.incomeCard).toBeVisible()
    await expect(this.expenseCard).toBeVisible()
    await expect(this.pendingCard).toBeVisible()
  }

  /**
   * Click on income card
   */
  async clickIncomeCard() {
    await this.incomeCard.click()
  }

  /**
   * Click on expense card
   */
  async clickExpenseCard() {
    await this.expenseCard.click()
  }
}
