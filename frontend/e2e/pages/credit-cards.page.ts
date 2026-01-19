import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Credit Cards Page Object
 */
export class CreditCardsPage extends BasePage {
  // Page elements
  readonly newCardButton: Locator
  readonly cardsGrid: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly limitInput: Locator
  readonly closingDayInput: Locator
  readonly dueDayInput: Locator
  readonly colorButtons: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator

  constructor(page: Page) {
    super(page, '/credit-cards')

    this.newCardButton = page.locator('button:has-text("Novo Cartão"), button:has-text("Novo")')
    this.cardsGrid = page.locator('.grid')

    // Modal elements
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('input[name="name"]')
    // CurrencyInput doesn't have name attr, find by label
    this.limitInput = page.locator('div:has(> label:has-text("Limite")) input')
    this.closingDayInput = page.locator('input[name="closing_day"]')
    this.dueDayInput = page.locator('input[name="due_day"]')
    this.colorButtons = page.locator('button.w-8.h-8.rounded-full')
    this.saveButton = page.locator('button[type="submit"]:has-text("Salvar"), button:has-text("Salvar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
  }

  /**
   * Click new card button
   */
  async clickNewCard() {
    await this.newCardButton.first().click()
    await this.page.waitForTimeout(500)

    // Check if template selector is shown, click "Criar do zero" to skip
    const skipTemplateButton = this.page.locator('button:has-text("Criar do zero")')
    if (await skipTemplateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipTemplateButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Fill card name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill card limit
   */
  async fillLimit(limit: string) {
    await this.limitInput.fill(limit)
  }

  /**
   * Fill closing day
   */
  async fillClosingDay(day: string) {
    await this.closingDayInput.fill(day)
  }

  /**
   * Fill due day
   */
  async fillDueDay(day: string) {
    await this.dueDayInput.fill(day)
  }

  /**
   * Select color
   */
  async selectColor(index: number = 0) {
    const buttons = await this.colorButtons.all()
    if (buttons[index]) {
      await buttons[index].click()
    }
  }

  /**
   * Save card
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
   * Create new credit card
   */
  async createCard(data: {
    name: string
    limit: string
    closingDay: string
    dueDay: string
    colorIndex?: number
  }) {
    await this.clickNewCard()
    await this.fillName(data.name)
    await this.fillLimit(data.limit)
    await this.fillClosingDay(data.closingDay)
    await this.fillDueDay(data.dueDay)

    if (data.colorIndex !== undefined) {
      await this.selectColor(data.colorIndex)
    }

    await this.save()
  }

  /**
   * Get card element by name
   */
  getCard(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if card exists
   */
  async cardExists(name: string): Promise<boolean> {
    return this.getCard(name).first().isVisible()
  }

  /**
   * Open card menu (•••)
   */
  async openCardMenu(name: string) {
    const card = this.getCard(name)
    await card.locator('button:has-text("•••"), button[aria-label*="menu"]').click()
    await this.page.waitForTimeout(200)
  }

  /**
   * View card invoices
   */
  async viewInvoices(name: string) {
    await this.openCardMenu(name)
    await this.page.locator('text=Ver Faturas').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Recalculate invoices
   */
  async recalculateInvoices(name: string) {
    await this.openCardMenu(name)
    await this.page.locator('text=Recalcular').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Delete card
   */
  async deleteCard(name: string) {
    const card = this.getCard(name)
    await card.locator('button:has(svg[class*="trash"])').click()
    // Handle confirmation
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get card limit by name
   */
  async getCardLimit(name: string): Promise<string> {
    const card = this.getCard(name)
    const limit = await card.locator('text=Limite').locator('..').textContent()
    return limit || ''
  }

  /**
   * Get card used amount
   */
  async getCardUsed(name: string): Promise<string> {
    const card = this.getCard(name)
    const used = await card.locator('text=Usado').locator('..').textContent()
    return used || ''
  }

  /**
   * Get card available amount
   */
  async getCardAvailable(name: string): Promise<string> {
    const card = this.getCard(name)
    const available = await card.locator('text=Disponível').locator('..').textContent()
    return available || ''
  }

  /**
   * Get all card names
   */
  async getAllCardNames(): Promise<string[]> {
    const names = this.page.locator('.card h3, .card .font-medium')
    return names.allTextContents()
  }

  /**
   * Assert card exists
   */
  async assertCardExists(name: string) {
    await expect(this.getCard(name).first()).toBeVisible()
  }

  /**
   * Assert card doesn't exist
   */
  async assertCardNotExists(name: string) {
    await expect(this.getCard(name)).not.toBeVisible()
  }
}
