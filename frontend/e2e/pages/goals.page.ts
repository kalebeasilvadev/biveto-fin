import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Goals Page Object
 */
export class GoalsPage extends BasePage {
  // Actions
  readonly newGoalButton: Locator
  readonly emergencyReserveButton: Locator
  readonly pnifButton: Locator

  // Goals list
  readonly goalsList: Locator
  readonly goalCards: Locator

  // Modal elements
  readonly modal: Locator
  readonly nameInput: Locator
  readonly targetInput: Locator
  readonly deadlineInput: Locator
  readonly contributeButton: Locator
  readonly contributionInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  // Calculator modals
  readonly emergencyModal: Locator
  readonly pnifModal: Locator

  constructor(page: Page) {
    super(page, '/goals')

    // Actions
    this.newGoalButton = page.locator('button:has-text("Nova Meta"), button:has-text("Nova")')
    this.emergencyReserveButton = page.locator('button:has-text("Calcular Reserva")')
    this.pnifButton = page.locator('button:has-text("PNIF")')

    // Goals list
    this.goalsList = page.locator('.grid, .space-y-4')
    this.goalCards = page.locator('.card')

    // Modal
    this.modal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.nameInput = page.locator('label:has-text("Nome") ~ input').first()
    this.targetInput = page.locator('label:has-text("Valor") ~ input, label:has-text("Meta") ~ input').first()
    this.deadlineInput = page.locator('input[type="date"]')
    this.contributeButton = page.locator('button:has-text("Contribuir")')
    this.contributionInput = page.locator('label:has-text("Valor") ~ input').first()
    // Use exact match for Criar to avoid matching "Criar primeira meta"
    this.saveButton = page.getByRole('button', { name: 'Criar', exact: true })
    this.cancelButton = page.locator('button:has-text("Cancelar")')
    this.deleteButton = page.locator('button:has-text("Excluir")')

    // Calculator modals
    this.emergencyModal = page.locator('.modal:has-text("Reserva")')
    this.pnifModal = page.locator('.modal:has-text("PNIF")')
  }

  /**
   * Click new goal button
   */
  async clickNewGoal() {
    await this.newGoalButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill goal name
   */
  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  /**
   * Fill target amount
   */
  async fillTarget(amount: string) {
    await this.targetInput.fill(amount)
  }

  /**
   * Fill deadline date
   */
  async fillDeadline(date: string) {
    await this.deadlineInput.fill(date)
  }

  /**
   * Save goal
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
   * Create new goal
   */
  async createGoal(data: {
    name: string
    target: string
    deadline?: string
  }) {
    await this.clickNewGoal()
    await this.fillName(data.name)
    await this.fillTarget(data.target)

    if (data.deadline) {
      await this.fillDeadline(data.deadline)
    }

    await this.save()
  }

  /**
   * Get goal by name
   */
  getGoal(name: string): Locator {
    return this.page.locator(`.card:has-text("${name}")`)
  }

  /**
   * Check if goal exists
   */
  async goalExists(name: string): Promise<boolean> {
    return this.getGoal(name).first().isVisible()
  }

  /**
   * Get goal progress
   */
  async getGoalProgress(name: string): Promise<{ current: string; target: string; percentage: string }> {
    const goal = this.getGoal(name)
    const current = await goal.locator('.font-bold').first().textContent()
    const target = await goal.locator('text=de R$').textContent()
    const percentage = await goal.locator('text=%').textContent()

    return {
      current: current || '',
      target: target || '',
      percentage: percentage || '',
    }
  }

  /**
   * Click contribute button on goal
   */
  async clickContribute(goalName: string) {
    const goal = this.getGoal(goalName)
    await goal.locator('button:has-text("Contribuir")').click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Add contribution to goal
   */
  async addContribution(goalName: string, amount: string) {
    await this.clickContribute(goalName)
    await this.contributionInput.fill(amount)
    await this.page.locator('button:has-text("Registrar"), button:has-text("Confirmar")').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Click emergency reserve calculator
   */
  async clickEmergencyReserve() {
    await this.emergencyReserveButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click PNIF calculator
   */
  async clickPNIF() {
    await this.pnifButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Calculate PNIF
   */
  async calculatePNIF(data: { annualIncome: string; expectedReturn: string }) {
    await this.clickPNIF()
    await this.page.locator('input').first().fill(data.annualIncome)
    await this.page.locator('input').last().fill(data.expectedReturn)
    await this.page.locator('button:has-text("Calcular")').click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Delete goal
   */
  async deleteGoal(name: string) {
    const goal = this.getGoal(name)
    await goal.locator('button:has(svg[class*="trash"])').click()
    // Handle confirmation
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get goal count
   */
  async getGoalCount(): Promise<number> {
    return this.goalCards.count()
  }

  /**
   * Get all goal names
   */
  async getAllGoalNames(): Promise<string[]> {
    const names = this.page.locator('.card h3, .card .font-medium')
    return names.allTextContents()
  }

  /**
   * Check if goal is completed
   */
  async isGoalCompleted(name: string): Promise<boolean> {
    const goal = this.getGoal(name)
    return goal.locator('text=100%, .text-green-500:has-text("Concluída")').isVisible()
  }

  /**
   * Assert goal exists
   */
  async assertGoalExists(name: string) {
    await expect(this.getGoal(name).first()).toBeVisible()
  }

  /**
   * Assert goal doesn't exist
   */
  async assertGoalNotExists(name: string) {
    await expect(this.getGoal(name)).not.toBeVisible()
  }
}
