import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Weekly Review Page Object
 */
export class WeeklyReviewPage extends BasePage {
  // Steps navigation
  readonly stepsIndicator: Locator
  readonly prevButton: Locator
  readonly nextButton: Locator
  readonly completeButton: Locator

  // Step content
  readonly stepContent: Locator
  readonly currentStepTitle: Locator

  // Step 1: Summary
  readonly summarySection: Locator
  readonly incomeTotal: Locator
  readonly expenseTotal: Locator

  // Step 2: Categorize transactions
  readonly uncategorizedList: Locator
  readonly categorySelect: Locator

  // Step 3: Review recurring
  readonly recurringSection: Locator

  // Step 4: Budget review
  readonly budgetSection: Locator

  // Step 5: Goals progress
  readonly goalsSection: Locator

  // Step 6: Action items
  readonly actionItems: Locator

  constructor(page: Page) {
    super(page, '/weekly-review')

    // Steps navigation
    this.stepsIndicator = page.locator('.steps, .step-indicator')
    this.prevButton = page.locator('button:has-text("Anterior")')
    this.nextButton = page.locator('button:has-text("Próximo")')
    this.completeButton = page.locator('button:has-text("Completar"), button:has-text("Finalizar")')

    // Step content
    this.stepContent = page.locator('.step-content, main')
    this.currentStepTitle = page.locator('h2, .step-title')

    // Step 1: Summary
    this.summarySection = page.locator('.summary, .card:has-text("Resumo")')
    this.incomeTotal = page.locator('text=Receitas').locator('..')
    this.expenseTotal = page.locator('text=Despesas').locator('..')

    // Step 2: Categorize
    this.uncategorizedList = page.locator('.uncategorized, .divide-y')
    this.categorySelect = page.locator('select')

    // Step 3: Recurring
    this.recurringSection = page.locator('.recurring, .card:has-text("Recorrentes")')

    // Step 4: Budget
    this.budgetSection = page.locator('.budget, .card:has-text("Orçamento")')

    // Step 5: Goals
    this.goalsSection = page.locator('.goals, .card:has-text("Metas")')

    // Step 6: Actions
    this.actionItems = page.locator('.actions, .card:has-text("Ações")')
  }

  /**
   * Get current step number
   */
  async getCurrentStep(): Promise<number> {
    const activeStep = this.page.locator('.step.active, .step-indicator .active')
    const text = await activeStep.textContent()
    return parseInt(text?.match(/\d+/)?.[0] || '1', 10)
  }

  /**
   * Get current step title
   */
  async getCurrentStepTitle(): Promise<string> {
    const text = await this.currentStepTitle.textContent()
    return text || ''
  }

  /**
   * Go to next step
   */
  async nextStep() {
    await this.nextButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Go to previous step
   */
  async previousStep() {
    await this.prevButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Go to specific step
   */
  async goToStep(stepNumber: number) {
    const stepButton = this.page.locator(`.step:nth-child(${stepNumber}), .step-indicator button:nth-child(${stepNumber})`)
    await stepButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Complete review
   */
  async complete() {
    await this.completeButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if at last step
   */
  async isAtLastStep(): Promise<boolean> {
    return this.completeButton.isVisible()
  }

  /**
   * Check if at first step
   */
  async isAtFirstStep(): Promise<boolean> {
    return this.prevButton.isDisabled()
  }

  /**
   * Get summary income
   */
  async getSummaryIncome(): Promise<string> {
    const text = await this.incomeTotal.locator('.font-bold, .text-income').textContent()
    return text || ''
  }

  /**
   * Get summary expense
   */
  async getSummaryExpense(): Promise<string> {
    const text = await this.expenseTotal.locator('.font-bold, .text-expense').textContent()
    return text || ''
  }

  /**
   * Get uncategorized transactions count
   */
  async getUncategorizedCount(): Promise<number> {
    const items = this.uncategorizedList.locator('> div, > tr')
    return items.count()
  }

  /**
   * Categorize transaction
   */
  async categorizeTransaction(index: number, category: string) {
    const item = this.uncategorizedList.locator('> div, > tr').nth(index)
    await item.locator('select').selectOption({ label: category })
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if there are uncategorized transactions
   */
  async hasUncategorizedTransactions(): Promise<boolean> {
    const count = await this.getUncategorizedCount()
    return count > 0
  }

  /**
   * Navigate through all steps
   */
  async navigateAllSteps(): Promise<string[]> {
    const titles: string[] = []

    // Ensure we're at step 1
    while (!(await this.isAtFirstStep())) {
      await this.previousStep()
    }

    // Navigate through all steps
    while (true) {
      titles.push(await this.getCurrentStepTitle())

      if (await this.isAtLastStep()) {
        break
      }

      await this.nextStep()
    }

    return titles
  }

  /**
   * Complete full review
   */
  async completeFullReview() {
    // Navigate through all steps
    while (!(await this.isAtLastStep())) {
      await this.nextStep()
    }

    // Complete
    await this.complete()
  }

  /**
   * Assert at step
   */
  async assertAtStep(stepNumber: number) {
    const current = await this.getCurrentStep()
    expect(current).toBe(stepNumber)
  }

  /**
   * Assert review completed
   */
  async assertReviewCompleted() {
    const successMessage = this.page.locator('text=concluída, text=Completada')
    await expect(successMessage).toBeVisible()
  }
}
