import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Automations Page Object
 */
export class AutomationsPage extends BasePage {
  // Actions
  readonly newAutomationButton: Locator

  // Automations list
  readonly automationsList: Locator
  readonly automationCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly triggerTypeSelect: Locator
  readonly actionTypeSelect: Locator
  readonly scheduleInput: Locator
  readonly sourceAccountSelect: Locator
  readonly targetAccountSelect: Locator
  readonly amountInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  // Activation toggle
  readonly activationToggle: Locator

  // History modal
  readonly historyButton: Locator
  readonly historyModal: Locator
  readonly historyList: Locator

  constructor(page: Page) {
    super(page, '/automations')

    // Actions
    this.newAutomationButton = page.locator('button:has-text("Nova Automação"), button:has-text("Nova"), button:has-text("+")')

    // Automations list
    this.automationsList = page.locator('.grid, .space-y-4')
    this.automationCards = page.locator('.card')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('label:has-text("Nome") ~ input').first()
    this.triggerTypeSelect = page.locator('label:has-text("Trigger") ~ select, label:has-text("Gatilho") ~ select')
    this.actionTypeSelect = page.locator('label:has-text("Ação") ~ select')
    this.scheduleInput = page.locator('label:has-text("Agenda") ~ input, label:has-text("Dia") ~ input')
    this.sourceAccountSelect = page.locator('label:has-text("Origem") ~ select, label:has-text("De") ~ select')
    this.targetAccountSelect = page.locator('label:has-text("Destino") ~ select, label:has-text("Para") ~ select')
    this.amountInput = page.locator('label:has-text("Valor") ~ input').first()
    this.saveButton = page.locator('button:has-text("Salvar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')

    // Activation
    this.activationToggle = page.locator('input[type="checkbox"], [role="switch"]')

    // History
    this.historyButton = page.locator('button:has-text("Histórico")')
    this.historyModal = page.locator('.modal:has-text("Histórico")')
    this.historyList = page.locator('.modal .divide-y, .modal .space-y-2')
  }

  /**
   * Click new automation button
   */
  async clickNewAutomation() {
    await this.newAutomationButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill automation name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Select trigger type
   */
  async selectTriggerType(type: string) {
    await this.triggerTypeSelect.selectOption({ label: type })
  }

  /**
   * Select action type
   */
  async selectActionType(type: string) {
    await this.actionTypeSelect.selectOption({ label: type })
  }

  /**
   * Fill schedule (for scheduled triggers)
   */
  async fillSchedule(value: string) {
    await this.scheduleInput.fill(value)
  }

  /**
   * Select source account
   */
  async selectSourceAccount(accountName: string) {
    await this.sourceAccountSelect.selectOption({ label: accountName })
  }

  /**
   * Select target account
   */
  async selectTargetAccount(accountName: string) {
    await this.targetAccountSelect.selectOption({ label: accountName })
  }

  /**
   * Fill amount
   */
  async fillAmount(amount: string) {
    await this.amountInput.fill(amount)
  }

  /**
   * Save automation
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
   * Create new automation
   */
  async createAutomation(data: {
    name: string
    triggerType?: string
    actionType?: string
    schedule?: string
    sourceAccount?: string
    targetAccount?: string
    amount?: string
  }) {
    await this.clickNewAutomation()
    await this.fillName(data.name)

    if (data.triggerType) {
      await this.selectTriggerType(data.triggerType)
    }

    if (data.actionType) {
      await this.selectActionType(data.actionType)
    }

    if (data.schedule) {
      await this.fillSchedule(data.schedule)
    }

    if (data.sourceAccount) {
      await this.selectSourceAccount(data.sourceAccount)
    }

    if (data.targetAccount) {
      await this.selectTargetAccount(data.targetAccount)
    }

    if (data.amount) {
      await this.fillAmount(data.amount)
    }

    await this.save()
  }

  /**
   * Get automation by name
   */
  getAutomation(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if automation exists
   */
  async automationExists(name: string): Promise<boolean> {
    return this.getAutomation(name).isVisible()
  }

  /**
   * Toggle automation activation
   */
  async toggleActivation(name: string) {
    const automation = this.getAutomation(name)
    await automation.locator('input[type="checkbox"], [role="switch"]').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if automation is active
   */
  async isAutomationActive(name: string): Promise<boolean> {
    const automation = this.getAutomation(name)
    return automation.locator('.text-green-, text=Ativo').isVisible()
  }

  /**
   * Execute automation manually
   */
  async executeManually(name: string) {
    const automation = this.getAutomation(name)
    await automation.locator('button:has-text("Executar")').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * View history
   */
  async viewHistory(name: string) {
    const automation = this.getAutomation(name)
    await automation.locator('button:has-text("Histórico")').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Get history entries
   */
  async getHistoryEntries(): Promise<string[]> {
    await expect(this.historyModal).toBeVisible()
    const entries = this.historyList.locator('> div')
    return entries.allTextContents()
  }

  /**
   * Close history modal
   */
  async closeHistoryModal() {
    const closeButton = this.page.locator('button:has(svg[class*="x"])').first()
    await closeButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Delete automation
   */
  async deleteAutomation(name: string) {
    const automation = this.getAutomation(name)
    await automation.locator('button:has(svg[class*="trash"])').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get automation count
   */
  async getAutomationCount(): Promise<number> {
    return this.automationCards.count()
  }

  /**
   * Assert automation exists
   */
  async assertAutomationExists(name: string) {
    await expect(this.getAutomation(name)).toBeVisible()
  }

  /**
   * Assert automation doesn't exist
   */
  async assertAutomationNotExists(name: string) {
    await expect(this.getAutomation(name)).not.toBeVisible()
  }
}
