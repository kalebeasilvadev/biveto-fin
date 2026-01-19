import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Invoices Page Object
 */
export class InvoicesPage extends BasePage {
  // Selectors
  readonly cardSelector: Locator
  readonly yearSelector: Locator
  readonly monthTabs: Locator

  // Invoice list
  readonly invoicesList: Locator
  readonly invoiceCards: Locator

  // Pay modal
  readonly payButton: Locator
  readonly payModal: Locator
  readonly accountSelect: Locator
  readonly paymentValueInput: Locator
  readonly confirmPaymentButton: Locator

  // Invoice detail modal
  readonly detailModal: Locator
  readonly transactionsList: Locator

  constructor(page: Page) {
    super(page, '/invoices')

    // Selectors
    this.cardSelector = page.locator('select').first()
    this.yearSelector = page.locator('select:has-text("202")')
    this.monthTabs = page.locator('[role="tablist"], .flex.gap-1')

    // Invoice list
    this.invoicesList = page.locator('.space-y-4, .divide-y')
    this.invoiceCards = page.locator('.card')

    // Pay modal
    this.payButton = page.locator('button:has-text("Pagar")')
    this.payModal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.accountSelect = page.locator('label:has-text("Conta") ~ select')
    this.paymentValueInput = page.locator('label:has-text("Valor") ~ input')
    this.confirmPaymentButton = page.locator('button:has-text("Confirmar")')

    // Detail modal
    this.detailModal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.transactionsList = page.locator('.modal .divide-y, .modal .space-y-2')
  }

  /**
   * Select credit card
   */
  async selectCard(cardName: string) {
    await this.cardSelector.selectOption({ label: cardName })
    await this.page.waitForTimeout(500)
  }

  /**
   * Select year
   */
  async selectYear(year: string) {
    await this.yearSelector.selectOption(year)
    await this.page.waitForTimeout(500)
  }

  /**
   * Select month
   */
  async selectMonth(monthName: string) {
    await this.page.locator(`button:has-text("${monthName}")`).click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get invoice by month/status
   */
  getInvoice(text: string): Locator {
    return this.page.locator(`.card:has-text("${text}")`)
  }

  /**
   * Get current invoice
   */
  getCurrentInvoice(): Locator {
    return this.page.locator('.card:has-text("Aberta"), .card:has-text("Atual")')
  }

  /**
   * Get invoice total
   */
  async getInvoiceTotal(invoiceLocator: Locator): Promise<string> {
    const total = await invoiceLocator.locator('.text-2xl, .font-bold').textContent()
    return total || ''
  }

  /**
   * Get invoice status
   */
  async getInvoiceStatus(invoiceLocator: Locator): Promise<string> {
    const status = await invoiceLocator.locator('.badge, .px-2.py-1.rounded').textContent()
    return status || ''
  }

  /**
   * Click on invoice to see details
   */
  async viewInvoiceDetails(text: string) {
    await this.getInvoice(text).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click pay invoice button
   */
  async clickPayInvoice(invoiceText: string) {
    const invoice = this.getInvoice(invoiceText)
    await invoice.locator('button:has-text("Pagar")').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Pay invoice
   */
  async payInvoice(data: {
    invoiceText: string
    accountName: string
    value?: string
  }) {
    await this.clickPayInvoice(data.invoiceText)

    await this.accountSelect.selectOption({ label: data.accountName })

    if (data.value) {
      await this.paymentValueInput.fill(data.value)
    }

    await this.confirmPaymentButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if invoice is paid
   */
  async isInvoicePaid(invoiceText: string): Promise<boolean> {
    const invoice = this.getInvoice(invoiceText)
    const status = await invoice.locator('.badge, .text-green-').textContent()
    return status?.toLowerCase().includes('pago') || status?.toLowerCase().includes('paid') || false
  }

  /**
   * Get invoice count
   */
  async getInvoiceCount(): Promise<number> {
    return this.invoiceCards.count()
  }

  /**
   * Get all card names from selector
   */
  async getAllCardOptions(): Promise<string[]> {
    const options = await this.cardSelector.locator('option').allTextContents()
    return options
  }

  /**
   * Check if showing empty state
   */
  async isShowingEmptyState(): Promise<boolean> {
    return this.page.locator('text=Nenhuma fatura').isVisible()
  }

  /**
   * Close detail modal
   */
  async closeDetailModal() {
    const closeButton = this.page.locator('button:has(svg[class*="x"])').first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Get transactions in detail modal
   */
  async getDetailTransactions(): Promise<string[]> {
    await expect(this.detailModal).toBeVisible()
    const transactions = this.detailModal.locator('.divide-y > div, .transaction-item')
    return transactions.allTextContents()
  }

  /**
   * Assert invoice is paid
   */
  async assertInvoicePaid(invoiceText: string) {
    const isPaid = await this.isInvoicePaid(invoiceText)
    expect(isPaid).toBe(true)
  }
}
