import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Envelopes Page Object
 */
export class EnvelopesPage extends BasePage {
  // Summary
  readonly summaryCard: Locator

  // Actions
  readonly newEnvelopeButton: Locator

  // Envelopes list
  readonly envelopesList: Locator
  readonly envelopeCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly limitInput: Locator
  readonly periodSelect: Locator
  readonly rolloverCheckbox: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  // Transfer modal
  readonly transferButton: Locator
  readonly transferModal: Locator
  readonly sourceEnvelopeSelect: Locator
  readonly targetEnvelopeSelect: Locator
  readonly transferAmountInput: Locator
  readonly confirmTransferButton: Locator

  constructor(page: Page) {
    super(page, '/envelopes')

    // Summary
    this.summaryCard = page.locator('.card:has-text("Resumo"), .card:has-text("Total")')

    // Actions
    this.newEnvelopeButton = page.locator('button:has-text("Novo Envelope"), button:has-text("Novo"), button:has-text("+")')

    // Envelopes list
    this.envelopesList = page.locator('.grid, .space-y-4')
    this.envelopeCards = page.locator('.card')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('label:has-text("Nome") ~ input').first()
    this.limitInput = page.locator('label:has-text("Limite") ~ input').first()
    this.periodSelect = page.locator('label:has-text("Período") ~ select')
    this.rolloverCheckbox = page.locator('input[type="checkbox"]')
    this.saveButton = page.locator('button:has-text("Salvar"), button:has-text("Criar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')

    // Transfer modal
    this.transferButton = page.locator('button:has-text("Transferir")')
    this.transferModal = page.locator('.modal:has-text("Transferir")')
    this.sourceEnvelopeSelect = page.locator('label:has-text("Origem") ~ select')
    this.targetEnvelopeSelect = page.locator('label:has-text("Destino") ~ select')
    this.transferAmountInput = page.locator('label:has-text("Valor") ~ input').first()
    this.confirmTransferButton = page.locator('button:has-text("Confirmar")')
  }

  /**
   * Click new envelope button
   */
  async clickNewEnvelope() {
    await this.newEnvelopeButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill envelope name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill limit
   */
  async fillLimit(limit: string) {
    await this.limitInput.fill(limit)
  }

  /**
   * Select period
   */
  async selectPeriod(period: 'Mensal' | 'Semanal' | 'Anual') {
    await this.periodSelect.selectOption({ label: period })
  }

  /**
   * Toggle rollover checkbox
   */
  async toggleRollover() {
    await this.rolloverCheckbox.click()
  }

  /**
   * Save envelope
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
   * Create new envelope
   */
  async createEnvelope(data: {
    name: string
    limit: string
    period?: 'Mensal' | 'Semanal' | 'Anual'
    allowRollover?: boolean
  }) {
    await this.clickNewEnvelope()
    await this.fillName(data.name)
    await this.fillLimit(data.limit)

    if (data.period) {
      await this.selectPeriod(data.period)
    }

    if (data.allowRollover) {
      await this.toggleRollover()
    }

    await this.save()
  }

  /**
   * Get envelope by name
   */
  getEnvelope(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if envelope exists
   */
  async envelopeExists(name: string): Promise<boolean> {
    return this.getEnvelope(name).isVisible()
  }

  /**
   * Click transfer button on envelope
   */
  async clickTransfer(name: string) {
    const envelope = this.getEnvelope(name)
    await envelope.locator('button:has-text("Transferir")').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Transfer between envelopes
   */
  async transferBetweenEnvelopes(data: {
    from: string
    to: string
    amount: string
  }) {
    await this.clickTransfer(data.from)
    await this.targetEnvelopeSelect.selectOption({ label: data.to })
    await this.transferAmountInput.fill(data.amount)
    await this.confirmTransferButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Get envelope balance
   */
  async getEnvelopeBalance(name: string): Promise<string> {
    const envelope = this.getEnvelope(name)
    const balance = await envelope.locator('.text-2xl, .font-bold').textContent()
    return balance || ''
  }

  /**
   * Get envelope limit
   */
  async getEnvelopeLimit(name: string): Promise<string> {
    const envelope = this.getEnvelope(name)
    const limit = await envelope.locator('text=Limite').locator('..').textContent()
    return limit || ''
  }

  /**
   * Click edit envelope
   */
  async clickEdit(name: string) {
    const envelope = this.getEnvelope(name)
    await envelope.locator('button:has(svg[class*="pencil"])').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Delete envelope
   */
  async deleteEnvelope(name: string) {
    const envelope = this.getEnvelope(name)
    await envelope.locator('button:has(svg[class*="trash"])').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get envelope count
   */
  async getEnvelopeCount(): Promise<number> {
    return this.envelopeCards.count()
  }

  /**
   * Assert envelope exists
   */
  async assertEnvelopeExists(name: string) {
    await expect(this.getEnvelope(name)).toBeVisible()
  }

  /**
   * Assert envelope doesn't exist
   */
  async assertEnvelopeNotExists(name: string) {
    await expect(this.getEnvelope(name)).not.toBeVisible()
  }
}
