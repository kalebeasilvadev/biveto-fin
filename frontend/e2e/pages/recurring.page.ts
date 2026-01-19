import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Recurring Transactions Page Object
 */
export class RecurringPage extends BasePage {
  // Actions
  readonly addButton: Locator

  // Recurring list
  readonly recurringList: Locator
  readonly recurringCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly amountInput: Locator
  readonly typeSelect: Locator
  readonly frequencySelect: Locator
  readonly dayInput: Locator
  readonly accountSelect: Locator
  readonly categorySelect: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    super(page, '/recurring')

    // Actions
    this.addButton = page.locator('button:has-text("Nova Recorrência"), button:has-text("Adicionar")')

    // Recurring list
    this.recurringList = page.locator('.grid, .space-y-4')
    this.recurringCards = page.locator('.card')

    // Form (inline, not modal)
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('input[placeholder*="Aluguel"], input[placeholder*="Netflix"]')
    this.amountInput = page.locator('input[type="number"]').first()
    this.typeSelect = page.locator('select').first() // First select is type
    this.accountSelect = page.locator('select').nth(1) // Second select is account (when in debit mode)
    this.categorySelect = page.locator('select').nth(2) // Third select is category
    this.frequencySelect = page.locator('select').nth(3) // Fourth select is frequency
    this.dayInput = page.locator('input[type="number"]').nth(1) // Second number input is day
    // Save button can be "Criar" or "Salvar"
    this.saveButton = page.getByRole('button', { name: /Criar|Salvar/ })
    this.cancelButton = page.getByRole('button', { name: 'Cancelar' })
    this.deleteButton = page.locator('button:has-text("Excluir")')
  }

  /**
   * Click add button
   */
  async clickAdd() {
    await this.addButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill amount
   */
  async fillAmount(amount: string) {
    await this.amountInput.fill(amount)
  }

  /**
   * Select type
   */
  async selectType(type: 'Receita' | 'Despesa') {
    await this.typeSelect.selectOption({ label: type })
  }

  /**
   * Select frequency
   */
  async selectFrequency(frequency: 'Mensal' | 'Semanal' | 'Anual') {
    await this.frequencySelect.selectOption({ label: frequency })
  }

  /**
   * Fill day
   */
  async fillDay(day: string) {
    await this.dayInput.fill(day)
  }

  /**
   * Select account
   */
  async selectAccount(accountName: string) {
    await this.accountSelect.selectOption({ label: new RegExp(accountName) })
  }

  /**
   * Select first available account
   */
  async selectFirstAccount() {
    const options = await this.accountSelect.locator('option').all()
    // Skip first option (usually "Selecione...")
    if (options.length > 1) {
      const secondOption = await options[1].getAttribute('value')
      if (secondOption) {
        await this.accountSelect.selectOption(secondOption)
      }
    }
  }

  /**
   * Select category
   */
  async selectCategory(category: string) {
    await this.categorySelect.selectOption({ label: category })
  }

  /**
   * Save recurring
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
   * Create new recurring transaction
   */
  async createRecurring(data: {
    name: string
    amount: string
    type?: 'Receita' | 'Despesa'
    frequency?: 'Mensal' | 'Semanal' | 'Anual'
    day?: string
    account?: string
    category?: string
  }) {
    await this.clickAdd()

    // Wait for form to be ready
    await this.page.waitForTimeout(500)

    await this.fillName(data.name)
    await this.fillAmount(data.amount)

    if (data.type) {
      await this.selectType(data.type)
    }

    if (data.frequency) {
      await this.selectFrequency(data.frequency)
    }

    if (data.day) {
      await this.fillDay(data.day)
    }

    // Account is required - select provided or first available
    if (data.account) {
      await this.selectAccount(data.account)
    } else {
      await this.selectFirstAccount()
    }

    if (data.category) {
      await this.selectCategory(data.category)
    }

    await this.save()
  }

  /**
   * Get recurring by name
   */
  getRecurring(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if recurring exists
   */
  async recurringExists(name: string): Promise<boolean> {
    return this.getRecurring(name).isVisible()
  }

  /**
   * Click pause/resume toggle
   */
  async togglePause(name: string) {
    const recurring = this.getRecurring(name)
    await recurring.locator('button:has(svg[class*="pause"]), button:has(svg[class*="play"])').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if recurring is paused
   */
  async isPaused(name: string): Promise<boolean> {
    const recurring = this.getRecurring(name)
    return recurring.locator('text=Pausado, .text-yellow-').isVisible()
  }

  /**
   * Click edit recurring
   */
  async clickEdit(name: string) {
    const recurring = this.getRecurring(name)
    await recurring.locator('button:has(svg[class*="pencil"])').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Delete recurring
   */
  async deleteRecurring(name: string) {
    const recurring = this.getRecurring(name)
    await recurring.locator('button:has(svg[class*="trash"])').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get recurring count
   */
  async getRecurringCount(): Promise<number> {
    return this.recurringCards.count()
  }

  /**
   * Get recurring value
   */
  async getRecurringValue(name: string): Promise<string> {
    const recurring = this.getRecurring(name)
    const value = await recurring.locator('.text-2xl, .font-bold').textContent()
    return value || ''
  }

  /**
   * Get next date
   */
  async getNextDate(name: string): Promise<string> {
    const recurring = this.getRecurring(name)
    const date = await recurring.locator('text=Próximo').locator('..').textContent()
    return date || ''
  }

  /**
   * Assert recurring exists
   */
  async assertRecurringExists(name: string) {
    await expect(this.getRecurring(name)).toBeVisible()
  }

  /**
   * Assert recurring doesn't exist
   */
  async assertRecurringNotExists(name: string) {
    await expect(this.getRecurring(name)).not.toBeVisible()
  }
}
