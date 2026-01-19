import { Page, Locator, expect } from '@playwright/test'
import { TEST_CREDENTIALS } from '../fixtures/test-data'

/**
 * Login Page Object
 */
export class LoginPage {
  readonly page: Page
  readonly path = '/login'

  // Form elements
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly logo: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[type="email"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.errorMessage = page.locator('text=Email ou senha incorretos, .text-red-500, [role="alert"]')
    this.logo = page.locator('img[alt="Biveto"]')
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto(this.path)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Check if on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes(this.path)
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email)
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password)
  }

  /**
   * Click submit button
   */
  async submit() {
    await this.submitButton.click()
  }

  /**
   * Login with provided credentials
   */
  async login(email?: string, password?: string) {
    await this.fillEmail(email || TEST_CREDENTIALS.email)
    await this.fillPassword(password || TEST_CREDENTIALS.password)
    await this.submit()
  }

  /**
   * Login with default test credentials
   */
  async loginWithTestCredentials() {
    await this.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password)
    await this.page.waitForURL('/', { timeout: 15000 })
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible()
  }

  /**
   * Get error message text
   */
  async getErrorText(): Promise<string> {
    if (await this.hasError()) {
      return this.errorMessage.textContent() || ''
    }
    return ''
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled()
  }

  /**
   * Check if email input is valid
   */
  async isEmailValid(): Promise<boolean> {
    const validationMessage = await this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    return validationMessage === ''
  }

  /**
   * Clear all fields
   */
  async clearFields() {
    await this.emailInput.clear()
    await this.passwordInput.clear()
  }

  /**
   * Expect to be redirected to dashboard after login
   */
  async expectRedirectToDashboard() {
    await this.page.waitForURL('/', { timeout: 15000 })
    await expect(this.page).toHaveURL('/')
  }

  /**
   * Expect to stay on login page
   */
  async expectStayOnLogin() {
    await expect(this.page).toHaveURL(/\/login/)
  }
}
