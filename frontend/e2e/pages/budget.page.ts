import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Budget Page Object
 */
export class BudgetPage extends BasePage {
  // Navigation
  readonly monthSelector: Locator
  readonly prevMonthButton: Locator
  readonly nextMonthButton: Locator

  // Actions
  readonly addButton: Locator
  readonly copyButton: Locator

  // Budget items
  readonly budgetItems: Locator
  readonly totalPlanned: Locator
  readonly totalSpent: Locator

  // Modal elements
  readonly modal: Locator
  readonly categorySelect: Locator
  readonly plannedInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    super(page, '/budget')

    // Navigation
    this.monthSelector = page.locator('.flex.items-center.gap-2')
    this.prevMonthButton = page.locator('button:has(svg[class*="chevron-left"])')
    this.nextMonthButton = page.locator('button:has(svg[class*="chevron-right"])')

    // Actions
    this.addButton = page.locator('button:has-text("Adicionar"), button:has-text("+")')
    this.copyButton = page.locator('button:has-text("Copiar")')

    // Budget items
    this.budgetItems = page.locator('.card, .budget-item')
    this.totalPlanned = page.locator('text=Planejado').locator('..')
    this.totalSpent = page.locator('text=Gasto').locator('..')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.categorySelect = page.locator('select').first()
    this.plannedInput = page.locator('input[type="number"], label:has-text("Valor") ~ input')
    this.saveButton = page.locator('button:has-text("Salvar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')
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
   * Get current month text
   */
  async getCurrentMonth(): Promise<string> {
    const text = await this.monthSelector.textContent()
    return text || ''
  }

  /**
   * Click add budget item button
   */
  async clickAdd() {
    await this.addButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click copy budget button
   */
  async clickCopy() {
    await this.copyButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Select category
   */
  async selectCategory(category: string) {
    await this.categorySelect.selectOption({ label: category })
  }

  /**
   * Fill planned amount
   */
  async fillPlanned(amount: string) {
    await this.plannedInput.fill(amount)
  }

  /**
   * Save budget item
   */
  async save() {
    await this.saveButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Cancel modal
   */
  async cancel() {
    await this.cancelButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Add budget item
   */
  async addBudgetItem(data: { category: string; planned: string }) {
    await this.clickAdd()
    await this.selectCategory(data.category)
    await this.fillPlanned(data.planned)
    await this.save()
  }

  /**
   * Get budget item by category
   */
  getBudgetItem(category: string): Locator {
    return this.page.locator(`.card:has-text("${category}"), .budget-item:has-text("${category}")`)
  }

  /**
   * Check if budget item exists
   */
  async budgetItemExists(category: string): Promise<boolean> {
    return this.getBudgetItem(category).isVisible()
  }

  /**
   * Get budget item progress
   */
  async getBudgetProgress(category: string): Promise<{ planned: string; spent: string }> {
    const item = this.getBudgetItem(category)
    const planned = await item.locator('.text-gray-500:has-text("R$")').first().textContent()
    const spent = await item.locator('.font-bold, .text-expense').textContent()
    return {
      planned: planned || '',
      spent: spent || '',
    }
  }

  /**
   * Click edit budget item
   */
  async clickEditItem(category: string) {
    await this.getBudgetItem(category).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Delete budget item
   */
  async deleteItem(category: string) {
    await this.clickEditItem(category)
    await this.deleteButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Copy budget to another month
   */
  async copyBudget(targetMonth: string) {
    await this.clickCopy()
    await this.page.locator(`button:has-text("${targetMonth}")`).click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get total planned
   */
  async getTotalPlanned(): Promise<string> {
    const text = await this.totalPlanned.locator('.font-bold, .text-2xl').textContent()
    return text || ''
  }

  /**
   * Get total spent
   */
  async getTotalSpent(): Promise<string> {
    const text = await this.totalSpent.locator('.font-bold, .text-2xl').textContent()
    return text || ''
  }

  /**
   * Get budget item count
   */
  async getBudgetItemCount(): Promise<number> {
    return this.budgetItems.count()
  }

  /**
   * Check if over budget
   */
  async isOverBudget(category: string): Promise<boolean> {
    const item = this.getBudgetItem(category)
    return item.locator('.text-red-500, .bg-red-').isVisible()
  }

  /**
   * Assert budget item exists
   */
  async assertBudgetItemExists(category: string) {
    await expect(this.getBudgetItem(category)).toBeVisible()
  }

  /**
   * Assert budget item doesn't exist
   */
  async assertBudgetItemNotExists(category: string) {
    await expect(this.getBudgetItem(category)).not.toBeVisible()
  }
}
