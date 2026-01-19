import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Simulators Page Object
 */
export class SimulatorsPage extends BasePage {
  // Tabs
  readonly debtsTab: Locator
  readonly emergencyTab: Locator
  readonly pnifTab: Locator

  // Debts simulator
  readonly monthlyPaymentInput: Locator
  readonly calculateDebtsButton: Locator
  readonly snowballResult: Locator
  readonly avalancheResult: Locator
  readonly payoffDateResult: Locator

  // Emergency simulator
  readonly monthsSelector: Locator
  readonly emergencyResult: Locator

  // PNIF simulator
  readonly annualIncomeInput: Locator
  readonly expectedReturnInput: Locator
  readonly calculatePnifButton: Locator
  readonly pnifResult: Locator

  constructor(page: Page) {
    super(page, '/simulators')

    // Tabs
    this.debtsTab = page.locator('button:has-text("Dívidas"), [role="tab"]:has-text("Dívidas")')
    this.emergencyTab = page.locator('button:has-text("Reserva"), [role="tab"]:has-text("Reserva")')
    this.pnifTab = page.locator('button:has-text("PNIF"), [role="tab"]:has-text("PNIF")')

    // Debts simulator
    this.monthlyPaymentInput = page.locator('label:has-text("Pagamento") ~ input')
    this.calculateDebtsButton = page.locator('button:has-text("Calcular")')
    this.snowballResult = page.locator('.card:has-text("Snowball"), .result:has-text("Snowball")')
    this.avalancheResult = page.locator('.card:has-text("Avalanche"), .result:has-text("Avalanche")')
    this.payoffDateResult = page.locator('text=Quitação').locator('..')

    // Emergency simulator
    this.monthsSelector = page.locator('select, input[type="number"]').first()
    this.emergencyResult = page.locator('.card:has-text("Recomendado"), .result')

    // PNIF simulator
    this.annualIncomeInput = page.locator('label:has-text("Renda") ~ input')
    this.expectedReturnInput = page.locator('label:has-text("Retorno") ~ input')
    this.calculatePnifButton = page.locator('button:has-text("Calcular")')
    this.pnifResult = page.locator('.card:has-text("PNIF"), .result')
  }

  /**
   * Select debts tab
   */
  async selectDebtsTab() {
    await this.debtsTab.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Select emergency tab
   */
  async selectEmergencyTab() {
    await this.emergencyTab.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Select PNIF tab
   */
  async selectPnifTab() {
    await this.pnifTab.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Calculate debt payoff
   */
  async calculateDebtPayoff(monthlyPayment: string) {
    await this.selectDebtsTab()
    await this.monthlyPaymentInput.fill(monthlyPayment)
    await this.calculateDebtsButton.click()
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
   * Get payoff date
   */
  async getPayoffDate(): Promise<string> {
    const text = await this.payoffDateResult.textContent()
    return text || ''
  }

  /**
   * Calculate emergency reserve
   */
  async calculateEmergency(months: string) {
    await this.selectEmergencyTab()
    await this.monthsSelector.fill(months)
    await this.page.waitForTimeout(500)
  }

  /**
   * Get emergency result
   */
  async getEmergencyResult(): Promise<string> {
    const text = await this.emergencyResult.locator('.text-2xl, .font-bold').textContent()
    return text || ''
  }

  /**
   * Calculate PNIF
   */
  async calculatePnif(annualIncome: string, expectedReturn: string) {
    await this.selectPnifTab()
    await this.annualIncomeInput.fill(annualIncome)
    await this.expectedReturnInput.fill(expectedReturn)
    await this.calculatePnifButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get PNIF result
   */
  async getPnifResult(): Promise<string> {
    const text = await this.pnifResult.locator('.text-2xl, .font-bold').textContent()
    return text || ''
  }

  /**
   * Check if debts tab is active
   */
  async isDebtsTabActive(): Promise<boolean> {
    return this.debtsTab.locator('.active, [aria-selected="true"]').isVisible()
  }

  /**
   * Check if emergency tab is active
   */
  async isEmergencyTabActive(): Promise<boolean> {
    return this.emergencyTab.locator('.active, [aria-selected="true"]').isVisible()
  }

  /**
   * Check if PNIF tab is active
   */
  async isPnifTabActive(): Promise<boolean> {
    return this.pnifTab.locator('.active, [aria-selected="true"]').isVisible()
  }

  /**
   * Assert results are visible
   */
  async assertResultsVisible() {
    const hasResults = await this.page.locator('.result, .card:has-text("R$")').isVisible()
    expect(hasResults).toBe(true)
  }
}
