import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Debts Page Object
 */
export class DebtsPage extends BasePage {
  // Summary
  readonly totalDebtsCard: Locator

  // Actions
  readonly addDebtButton: Locator
  readonly calculateStrategyButton: Locator

  // Debts list
  readonly debtsList: Locator
  readonly debtCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly originalValueInput: Locator
  readonly currentBalanceInput: Locator
  readonly interestRateInput: Locator
  readonly creditorInput: Locator
  readonly paymentInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly payButton: Locator

  // Strategy modal
  readonly strategyModal: Locator
  readonly monthlyPaymentInput: Locator
  readonly calculateButton: Locator
  readonly snowballResult: Locator
  readonly avalancheResult: Locator

  constructor(page: Page) {
    super(page, '/debts')

    // Summary
    this.totalDebtsCard = page.locator('.card:has-text("Total")')

    // Actions
    this.addDebtButton = page.locator('button:has-text("Adicionar Dívida"), button:has-text("Nova Dívida"), button:has-text("+")')
    this.calculateStrategyButton = page.locator('button:has-text("Calcular"), button:has-text("Estratégia")')

    // Debts list
    this.debtsList = page.locator('.grid, .space-y-4')
    this.debtCards = page.locator('.card')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('label:has-text("Nome") ~ input').first()
    this.originalValueInput = page.locator('label:has-text("Original") ~ input')
    this.currentBalanceInput = page.locator('label:has-text("Saldo") ~ input')
    this.interestRateInput = page.locator('label:has-text("Juros") ~ input, label:has-text("Taxa") ~ input')
    this.creditorInput = page.locator('label:has-text("Credor") ~ input')
    this.paymentInput = page.locator('label:has-text("Valor") ~ input').first()
    this.saveButton = page.locator('button:has-text("Salvar"), button:has-text("Criar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.payButton = page.locator('button:has-text("Pagar")')

    // Strategy modal
    this.strategyModal = page.locator('.modal:has-text("Estratégia")')
    this.monthlyPaymentInput = page.locator('label:has-text("Pagamento") ~ input')
    this.calculateButton = page.locator('button:has-text("Calcular")')
    this.snowballResult = page.locator('.card:has-text("Snowball")')
    this.avalancheResult = page.locator('.card:has-text("Avalanche")')
  }

  /**
   * Get total debt value
   */
  async getTotalDebt(): Promise<string> {
    const text = await this.totalDebtsCard.locator('.text-2xl, .font-bold').textContent()
    return text || ''
  }

  /**
   * Click add debt button
   */
  async clickAddDebt() {
    await this.addDebtButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill debt name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill original value
   */
  async fillOriginalValue(value: string) {
    await this.originalValueInput.fill(value)
  }

  /**
   * Fill current balance
   */
  async fillCurrentBalance(balance: string) {
    await this.currentBalanceInput.fill(balance)
  }

  /**
   * Fill interest rate
   */
  async fillInterestRate(rate: string) {
    await this.interestRateInput.fill(rate)
  }

  /**
   * Fill creditor
   */
  async fillCreditor(creditor: string) {
    await this.creditorInput.fill(creditor)
  }

  /**
   * Save debt
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
   * Create new debt
   */
  async createDebt(data: {
    name: string
    originalValue: string
    currentBalance: string
    interestRate?: string
    creditor?: string
  }) {
    await this.clickAddDebt()
    await this.fillName(data.name)
    await this.fillOriginalValue(data.originalValue)
    await this.fillCurrentBalance(data.currentBalance)

    if (data.interestRate) {
      await this.fillInterestRate(data.interestRate)
    }

    if (data.creditor) {
      await this.fillCreditor(data.creditor)
    }

    await this.save()
  }

  /**
   * Get debt by name
   */
  getDebt(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if debt exists
   */
  async debtExists(name: string): Promise<boolean> {
    return this.getDebt(name).isVisible()
  }

  /**
   * Click pay button on debt
   */
  async clickPayDebt(debtName: string) {
    const debt = this.getDebt(debtName)
    await debt.locator('button:has-text("Pagar")').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Register payment
   */
  async registerPayment(debtName: string, amount: string) {
    await this.clickPayDebt(debtName)
    await this.paymentInput.fill(amount)
    await this.page.locator('button:has-text("Registrar"), button:has-text("Confirmar")').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get debt balance
   */
  async getDebtBalance(name: string): Promise<string> {
    const debt = this.getDebt(name)
    const balance = await debt.locator('.text-2xl, .font-bold').textContent()
    return balance || ''
  }

  /**
   * Click calculate strategy button
   */
  async clickCalculateStrategy() {
    await this.calculateStrategyButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Calculate debt payoff strategy
   */
  async calculateStrategy(monthlyPayment: string) {
    await this.clickCalculateStrategy()
    await this.monthlyPaymentInput.fill(monthlyPayment)
    await this.calculateButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get snowball result
   */
  async getSnowballResult(): Promise<string> {
    const text = await this.snowballResult.textContent()
    return text || ''
  }

  /**
   * Get avalanche result
   */
  async getAvalancheResult(): Promise<string> {
    const text = await this.avalancheResult.textContent()
    return text || ''
  }

  /**
   * Delete debt
   */
  async deleteDebt(name: string) {
    const debt = this.getDebt(name)
    await debt.locator('button:has(svg[class*="trash"])').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get debt count
   */
  async getDebtCount(): Promise<number> {
    return this.debtCards.count()
  }

  /**
   * Assert debt exists
   */
  async assertDebtExists(name: string) {
    await expect(this.getDebt(name)).toBeVisible()
  }

  /**
   * Assert debt doesn't exist
   */
  async assertDebtNotExists(name: string) {
    await expect(this.getDebt(name)).not.toBeVisible()
  }
}
