import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Transactions Page Object
 */
export class TransactionsPage extends BasePage {
  // Navigation
  readonly yearSelector: Locator
  readonly monthTabs: Locator

  // Filters
  readonly searchInput: Locator
  readonly categoryFilter: Locator
  readonly exportButton: Locator

  // Transaction list
  readonly transactionsList: Locator
  readonly transactionCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly descriptionInput: Locator
  readonly amountInput: Locator
  readonly categorySelect: Locator
  readonly accountSelect: Locator
  readonly dateInput: Locator
  readonly saveButton: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    super(page, '/transactions')

    // Navigation
    this.yearSelector = page.locator('select:has-text("202")').first()
    this.monthTabs = page.locator('[role="tablist"], .flex.gap-1')

    // Filters
    this.searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]')
    this.categoryFilter = page.locator('select:has-text("Categoria")')
    this.exportButton = page.locator('button:has-text("Exportar")')

    // Transaction list
    this.transactionsList = page.locator('.space-y-2, .divide-y')
    this.transactionCards = page.locator('.card, [class*="transaction"]')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.descriptionInput = page.locator('input[name="description"], label:has-text("Descrição") ~ input')
    this.amountInput = page.locator('input[type="number"], label:has-text("Valor") ~ input')
    this.categorySelect = page.locator('select:has-text("Categoria"), label:has-text("Categoria") ~ select')
    this.accountSelect = page.locator('select:has-text("Conta"), label:has-text("Conta") ~ select')
    this.dateInput = page.locator('input[type="date"]')
    this.saveButton = page.locator('button:has-text("Salvar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')
  }

  /**
   * Select year
   */
  async selectYear(year: string) {
    await this.yearSelector.selectOption(year)
    await this.page.waitForTimeout(500)
  }

  /**
   * Click month tab
   */
  async selectMonth(monthName: string) {
    await this.page.locator(`button:has-text("${monthName}"), a:has-text("${monthName}")`).click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Search transactions
   */
  async search(term: string) {
    await this.searchInput.fill(term)
    await this.page.waitForTimeout(500)
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(500)
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption({ label: category })
    await this.page.waitForTimeout(500)
  }

  /**
   * Export to CSV
   */
  async exportCSV(): Promise<boolean> {
    if (await this.exportButton.isVisible()) {
      const downloadPromise = this.page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
      await this.exportButton.click()
      const download = await downloadPromise
      return download !== null
    }
    return false
  }

  /**
   * Get transaction count
   */
  async getTransactionCount(): Promise<number> {
    const cards = this.page.locator('.card, [class*="transaction-item"]')
    return cards.count()
  }

  /**
   * Click on transaction by description
   */
  async clickTransaction(description: string) {
    await this.page.locator(`.card:has-text("${description}"), [class*="transaction"]:has-text("${description}")`).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Get transaction by description
   */
  getTransaction(description: string): Locator {
    return this.page.locator(`[class*="transaction"]:has-text("${description}"), .card:has-text("${description}")`)
  }

  /**
   * Check if transaction exists
   */
  async transactionExists(description: string): Promise<boolean> {
    return this.getTransaction(description).isVisible()
  }

  /**
   * Edit transaction amount
   */
  async editAmount(newAmount: string) {
    await this.amountInput.clear()
    await this.amountInput.fill(newAmount)
  }

  /**
   * Edit transaction description
   */
  async editDescription(newDescription: string) {
    await this.descriptionInput.clear()
    await this.descriptionInput.fill(newDescription)
  }

  /**
   * Save changes
   */
  async save() {
    await this.saveButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Delete transaction
   */
  async delete() {
    await this.deleteButton.click()
    // Handle confirmation dialog
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if showing empty state
   */
  async isShowingEmptyState(): Promise<boolean> {
    return this.page.locator('text=Nenhuma transação').isVisible()
  }

  /**
   * Get all transaction descriptions
   */
  async getAllDescriptions(): Promise<string[]> {
    const descriptions = this.page.locator('.transaction-description, .card h3, .font-medium')
    return descriptions.allTextContents()
  }

  /**
   * Navigate to next month
   */
  async nextMonth() {
    await this.page.locator('button:has(svg[class*="chevron-right"])').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Navigate to previous month
   */
  async previousMonth() {
    await this.page.locator('button:has(svg[class*="chevron-left"])').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Assert transaction is visible
   */
  async assertTransactionVisible(description: string) {
    await expect(this.getTransaction(description)).toBeVisible()
  }

  /**
   * Assert transaction is not visible
   */
  async assertTransactionNotVisible(description: string) {
    await expect(this.getTransaction(description)).not.toBeVisible()
  }
}
