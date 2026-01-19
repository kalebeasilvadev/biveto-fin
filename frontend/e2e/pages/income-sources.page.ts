import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Income Sources Page Object
 */
export class IncomeSourcesPage extends BasePage {
  // Summary
  readonly totalIncomeCard: Locator

  // Actions
  readonly newSourceButton: Locator
  readonly generateButton: Locator

  // Income sources list
  readonly sourcesList: Locator
  readonly sourceCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly typeSelect: Locator
  readonly amountInput: Locator
  readonly frequencySelect: Locator
  readonly dayInput: Locator
  readonly accountSelect: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  // Generate modal
  readonly generateModal: Locator
  readonly confirmGenerateButton: Locator

  constructor(page: Page) {
    super(page, '/income-sources')

    // Summary
    this.totalIncomeCard = page.locator('.card:has-text("Receita Esperada"), .card:has-text("Total")')

    // Actions
    this.newSourceButton = page.locator('button:has-text("Nova Fonte"), button:has-text("Nova"), button:has-text("+")')
    this.generateButton = page.locator('button:has-text("Registrar"), button:has-text("Gerar")')

    // Sources list
    this.sourcesList = page.locator('.grid, .space-y-4')
    this.sourceCards = page.locator('.card')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('label:has-text("Nome") ~ input').first()
    this.typeSelect = page.locator('label:has-text("Tipo") ~ select')
    this.amountInput = page.locator('label:has-text("Valor") ~ input').first()
    this.frequencySelect = page.locator('label:has-text("Frequência") ~ select')
    this.dayInput = page.locator('label:has-text("Dia") ~ input')
    this.accountSelect = page.locator('label:has-text("Conta") ~ select')
    this.saveButton = page.locator('button:has-text("Salvar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')

    // Generate modal
    this.generateModal = page.locator('.modal:has-text("Registrar")')
    this.confirmGenerateButton = page.locator('button:has-text("Confirmar")')
  }

  /**
   * Get total expected income
   */
  async getTotalIncome(): Promise<string> {
    const text = await this.totalIncomeCard.locator('.text-2xl, .font-bold').textContent()
    return text || ''
  }

  /**
   * Click new source button
   */
  async clickNewSource() {
    await this.newSourceButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill source name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Select type
   */
  async selectType(type: 'Salário' | 'Freelance' | 'Investimentos' | 'Outros') {
    await this.typeSelect.selectOption({ label: type })
  }

  /**
   * Fill expected amount
   */
  async fillAmount(amount: string) {
    await this.amountInput.fill(amount)
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
    await this.accountSelect.selectOption({ label: accountName })
  }

  /**
   * Save source
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
   * Create new income source
   */
  async createSource(data: {
    name: string
    type?: 'Salário' | 'Freelance' | 'Investimentos' | 'Outros'
    amount: string
    frequency?: 'Mensal' | 'Semanal' | 'Anual'
    day?: string
    account?: string
  }) {
    await this.clickNewSource()
    await this.fillName(data.name)

    if (data.type) {
      await this.selectType(data.type)
    }

    await this.fillAmount(data.amount)

    if (data.frequency) {
      await this.selectFrequency(data.frequency)
    }

    if (data.day) {
      await this.fillDay(data.day)
    }

    if (data.account) {
      await this.selectAccount(data.account)
    }

    await this.save()
  }

  /**
   * Get source by name
   */
  getSource(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if source exists
   */
  async sourceExists(name: string): Promise<boolean> {
    return this.getSource(name).isVisible()
  }

  /**
   * Click generate transactions button
   */
  async clickGenerate() {
    await this.generateButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Generate transactions from income sources
   */
  async generateTransactions() {
    await this.clickGenerate()
    await this.confirmGenerateButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Click edit source
   */
  async clickEdit(name: string) {
    const source = this.getSource(name)
    await source.locator('button:has(svg[class*="pencil"])').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Delete source
   */
  async deleteSource(name: string) {
    const source = this.getSource(name)
    await source.locator('button:has(svg[class*="trash"])').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get source count
   */
  async getSourceCount(): Promise<number> {
    return this.sourceCards.count()
  }

  /**
   * Get source value
   */
  async getSourceValue(name: string): Promise<string> {
    const source = this.getSource(name)
    const value = await source.locator('.text-2xl, .font-bold').textContent()
    return value || ''
  }

  /**
   * Assert source exists
   */
  async assertSourceExists(name: string) {
    await expect(this.getSource(name)).toBeVisible()
  }

  /**
   * Assert source doesn't exist
   */
  async assertSourceNotExists(name: string) {
    await expect(this.getSource(name)).not.toBeVisible()
  }
}
