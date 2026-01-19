import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Upload Page Object
 */
export class UploadPage extends BasePage {
  // Mode selection (UploadSelector component)
  readonly cameraButton: Locator
  readonly galleryButton: Locator
  readonly manualButton: Locator

  // File upload
  readonly fileInput: Locator
  readonly dropZone: Locator

  // Manual form (TransactionForm component)
  readonly expenseButton: Locator
  readonly incomeButton: Locator
  readonly amountInput: Locator
  readonly dateInput: Locator
  readonly accountSelect: Locator
  readonly categorySelect: Locator
  readonly descriptionInput: Locator

  // Installment options
  readonly installmentCheckbox: Locator
  readonly installmentCurrentInput: Locator
  readonly installmentTotalInput: Locator

  // Recurring options
  readonly recurringCheckbox: Locator

  // Actions
  readonly submitButton: Locator
  readonly cancelButton: Locator

  // Page state indicators
  readonly selectorHeading: Locator
  readonly formHeading: Locator

  constructor(page: Page) {
    super(page, '/upload')

    // Mode selection (UploadSelector) - these are card-style buttons
    this.cameraButton = page.locator('button.card:has-text("Tirar Foto")')
    this.galleryButton = page.locator('button.card:has-text("Galeria")')
    this.manualButton = page.locator('button.card:has-text("Manual")')

    // File upload
    this.fileInput = page.locator('input[type="file"]')
    this.dropZone = page.locator('.drop-zone, [class*="dropzone"]')

    // Page state indicators
    this.selectorHeading = page.locator('h1:has-text("Adicionar Transação")')
    this.formHeading = page.locator('h1:has-text("Nova Transação")')

    // Manual form (TransactionForm) - type buttons
    this.expenseButton = page.getByRole('button', { name: 'Despesa' })
    this.incomeButton = page.getByRole('button', { name: 'Receita' })

    // Amount input - type number with class input
    this.amountInput = page.locator('input[type="number"].input')

    // Date input
    this.dateInput = page.locator('input[type="date"]')

    // Account select - the dropdown after account type filter buttons
    this.accountSelect = page.locator('select.input').first()

    // Category select - second select.input on the form
    this.categorySelect = page.locator('select.input').nth(1)

    // Description input - text input with placeholder "Descrição da transação"
    this.descriptionInput = page.locator('input[placeholder="Descrição da transação"]')

    // Installment checkbox and inputs
    this.installmentCheckbox = page.locator('input[type="checkbox"]').first()
    this.installmentCurrentInput = page.locator('input[placeholder="1"]')
    this.installmentTotalInput = page.locator('input[placeholder="12"]')

    // Recurring checkbox
    this.recurringCheckbox = page.locator('label:has-text("Criar como transação recorrente") input[type="checkbox"]')

    // Actions
    this.submitButton = page.getByRole('button', { name: /Salvar|Confirmar/ })
    this.cancelButton = page.locator('button:has(svg)')  // X button
  }

  /**
   * Check if we're on the mode selector screen
   */
  async isOnSelectorScreen(): Promise<boolean> {
    return this.selectorHeading.isVisible({ timeout: 1000 }).catch(() => false)
  }

  /**
   * Check if we're on the manual form screen
   */
  async isOnFormScreen(): Promise<boolean> {
    return this.formHeading.isVisible({ timeout: 1000 }).catch(() => false)
  }

  /**
   * Select camera mode
   */
  async selectCameraMode() {
    if (await this.isOnSelectorScreen()) {
      await this.cameraButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Select gallery/file mode
   */
  async selectGalleryMode() {
    if (await this.isOnSelectorScreen()) {
      await this.galleryButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Select manual mode - navigates to the transaction form
   * If already on the form, does nothing
   */
  async selectManualMode() {
    // Check if we're already on the form
    if (await this.isOnFormScreen()) {
      return // Already on manual form
    }

    // Check if we're on selector screen
    if (await this.isOnSelectorScreen()) {
      await this.manualButton.click()
      await this.page.waitForTimeout(500)
      // Wait for form to appear
      await this.formHeading.waitFor({ state: 'visible', timeout: 5000 })
    }
  }

  /**
   * Select transaction type (Despesa/Receita)
   */
  async selectType(type: 'Receita' | 'Despesa') {
    if (type === 'Despesa') {
      await this.expenseButton.click()
    } else {
      await this.incomeButton.click()
    }
    await this.page.waitForTimeout(200)
  }

  /**
   * Fill amount
   */
  async fillAmount(amount: string) {
    await this.amountInput.fill(amount)
  }

  /**
   * Fill date
   */
  async fillDate(date: string) {
    await this.dateInput.fill(date)
  }

  /**
   * Select account by partial match
   */
  async selectAccount(accountName: string) {
    // First, make sure "Todas" filter is selected to see all accounts
    const todasButton = this.page.getByRole('button', { name: '💼 Todas' })
    if (await todasButton.isVisible()) {
      await todasButton.click()
      await this.page.waitForTimeout(200)
    }

    // Select from dropdown
    await this.accountSelect.selectOption({ label: new RegExp(accountName) })
  }

  /**
   * Select first available account
   */
  async selectFirstAccount() {
    // Ensure "Todas" filter is selected
    const todasButton = this.page.getByRole('button', { name: '💼 Todas' })
    if (await todasButton.isVisible()) {
      await todasButton.click()
      await this.page.waitForTimeout(200)
    }

    // Get available options (skip "Selecione")
    const options = await this.accountSelect.locator('option').all()
    if (options.length > 1) {
      const secondOption = await options[1].getAttribute('value')
      if (secondOption) {
        await this.accountSelect.selectOption(secondOption)
      }
    }
  }

  /**
   * Select category by name
   */
  async selectCategory(category: string) {
    await this.categorySelect.selectOption({ label: category })
  }

  /**
   * Fill description
   */
  async fillDescription(description: string) {
    await this.descriptionInput.fill(description)
  }

  /**
   * Toggle installment checkbox
   */
  async toggleInstallment() {
    await this.installmentCheckbox.click()
    await this.page.waitForTimeout(200)
  }

  /**
   * Fill installment details
   */
  async fillInstallmentDetails(current: string, total: string) {
    await this.installmentCurrentInput.fill(current)
    await this.installmentTotalInput.fill(total)
  }

  /**
   * Toggle recurring checkbox
   */
  async toggleRecurring() {
    await this.recurringCheckbox.click()
    await this.page.waitForTimeout(200)
  }

  /**
   * Submit form
   */
  async submit() {
    await this.submitButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Cancel and go back
   */
  async cancel() {
    await this.cancelButton.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Create manual transaction - complete flow
   */
  async createManualTransaction(data: {
    type: 'Receita' | 'Despesa'
    amount: string
    date?: string
    account?: string
    category?: string
    description?: string
  }) {
    // Ensure we're on the form (selectManualMode handles checking current state)
    await this.selectManualMode()

    // Select type
    await this.selectType(data.type)

    // Select account first (required field)
    if (data.account) {
      await this.selectAccount(data.account)
    } else {
      // Select first available account
      await this.selectFirstAccount()
    }

    // Fill amount
    await this.fillAmount(data.amount)

    // Fill optional fields
    if (data.date) {
      await this.fillDate(data.date)
    }

    if (data.category) {
      await this.selectCategory(data.category)
    }

    if (data.description) {
      await this.fillDescription(data.description)
    }

    // Submit
    await this.submit()
  }

  /**
   * Create installment transaction
   */
  async createInstallmentTransaction(data: {
    type: 'Receita' | 'Despesa'
    amount: string
    installmentCurrent: string
    installmentTotal: string
    account?: string
    category?: string
    description?: string
  }) {
    await this.selectManualMode()
    await this.selectType(data.type)

    if (data.account) {
      await this.selectAccount(data.account)
    } else {
      await this.selectFirstAccount()
    }

    await this.fillAmount(data.amount)

    if (data.category) {
      await this.selectCategory(data.category)
    }

    if (data.description) {
      await this.fillDescription(data.description)
    }

    // Enable installment and fill details
    await this.toggleInstallment()
    await this.fillInstallmentDetails(data.installmentCurrent, data.installmentTotal)

    await this.submit()
  }

  /**
   * Upload file
   */
  async uploadFile(filePath: string) {
    await this.selectGalleryMode()
    await this.fileInput.setInputFiles(filePath)
    await this.page.waitForTimeout(500)
  }

  /**
   * Check if manual form is visible
   */
  async isManualFormVisible(): Promise<boolean> {
    return this.amountInput.isVisible()
  }

  /**
   * Check if file upload is visible
   */
  async isFileUploadVisible(): Promise<boolean> {
    return this.dropZone.isVisible() || this.fileInput.isVisible()
  }

  /**
   * Assert transaction created successfully
   */
  async assertTransactionCreated() {
    const successMessage = this.page.locator('text=criada com sucesso, text=Sucesso')
    await expect(successMessage).toBeVisible({ timeout: 5000 })
  }

  /**
   * Wait for success message and dismiss it
   */
  async waitForSuccessAndDismiss() {
    // Wait for success message to appear
    const successCard = this.page.locator('.bg-green-50, .bg-green-900\\/30')
    await successCard.waitFor({ state: 'visible', timeout: 10000 })

    // Click "Criar outra transação" to reset form
    const createAnotherButton = this.page.locator('button:has-text("Criar outra transação"), text=Criar outra transação')
    if (await createAnotherButton.isVisible()) {
      await createAnotherButton.click()
      await this.page.waitForTimeout(300)
    }
  }
}
