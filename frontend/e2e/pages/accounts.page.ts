import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Accounts Page Object
 */
export class AccountsPage extends BasePage {
  // Page elements
  readonly totalBalanceCard: Locator
  readonly newAccountButton: Locator
  readonly accountsGrid: Locator

  // Modal elements
  readonly modal: Locator
  readonly typeSelect: Locator
  readonly nameInput: Locator
  readonly balanceInput: Locator
  readonly colorButtons: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator

  constructor(page: Page) {
    super(page, '/accounts')

    this.totalBalanceCard = page.locator('.card:has-text("Saldo Total")').first()
    this.newAccountButton = page.locator('button:has-text("Nova Conta"), button:has-text("Nova")')
    this.accountsGrid = page.locator('.grid')

    // Modal elements
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.typeSelect = page.locator('select').first()
    this.nameInput = page.locator('input[placeholder*="Nubank"], label:has-text("Nome") ~ input, label:has-text("Nome") + input').first()
    this.balanceInput = page.locator('input[placeholder*="0,00"], label:has-text("Saldo") ~ input, label:has-text("Saldo") + input').first()
    this.colorButtons = page.locator('button.w-8.h-8.rounded-full')
    this.saveButton = page.locator('button:has-text("Salvar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
  }

  /**
   * Get total balance value
   */
  async getTotalBalance(): Promise<string> {
    const text = await this.totalBalanceCard.locator('.text-3xl').textContent()
    return text || ''
  }

  /**
   * Get account count text
   */
  async getAccountCountText(): Promise<string> {
    const text = await this.totalBalanceCard.locator('.text-sm.opacity-75').textContent()
    return text || ''
  }

  /**
   * Click new account button
   */
  async clickNewAccount() {
    await this.newAccountButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if modal is open
   */
  async isModalOpen(): Promise<boolean> {
    return this.modal.isVisible()
  }

  /**
   * Select account type
   */
  async selectType(type: 'Carteira' | 'Banco' | 'Investimento') {
    await this.typeSelect.selectOption({ label: type })
  }

  /**
   * Fill account name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill initial balance
   */
  async fillBalance(balance: string) {
    await this.balanceInput.fill(balance)
  }

  /**
   * Select color by index
   */
  async selectColor(index: number = 0) {
    const buttons = await this.colorButtons.all()
    if (buttons[index]) {
      await buttons[index].click()
    }
  }

  /**
   * Save account
   */
  async save() {
    await this.saveButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Cancel and close modal
   */
  async cancel() {
    await this.cancelButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Create new account with all details
   */
  async createAccount(data: {
    name: string
    type?: 'Carteira' | 'Banco' | 'Investimento'
    balance?: string
    colorIndex?: number
  }) {
    await this.clickNewAccount()

    if (data.type) {
      await this.selectType(data.type)
    }

    await this.fillName(data.name)

    if (data.balance) {
      await this.fillBalance(data.balance)
    }

    if (data.colorIndex !== undefined) {
      await this.selectColor(data.colorIndex)
    }

    await this.save()
  }

  /**
   * Get account card by name
   */
  getAccountCard(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if account exists
   */
  async accountExists(name: string): Promise<boolean> {
    return this.getAccountCard(name).first().isVisible()
  }

  /**
   * Click edit button on account
   */
  async clickEditAccount(name: string) {
    const card = this.getAccountCard(name)
    await card.locator('button:has(svg)').first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click delete button on account
   */
  async clickDeleteAccount(name: string) {
    const card = this.getAccountCard(name)
    await card.locator('button:has(svg)').last().click()
  }

  /**
   * Confirm deletion in dialog
   */
  async confirmDelete() {
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
  }

  /**
   * Get all account names
   */
  async getAllAccountNames(): Promise<string[]> {
    const cards = this.page.locator('.card h3')
    return cards.allTextContents()
  }

  /**
   * Get account balance by name
   */
  async getAccountBalance(name: string): Promise<string> {
    const card = this.getAccountCard(name)
    const balance = await card.locator('.text-2xl').textContent()
    return balance || ''
  }

  /**
   * Assert account is in list
   */
  async assertAccountExists(name: string) {
    await expect(this.getAccountCard(name).first()).toBeVisible()
  }

  /**
   * Assert account is not in list
   */
  async assertAccountNotExists(name: string) {
    await expect(this.getAccountCard(name)).not.toBeVisible()
  }
}
