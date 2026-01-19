import { Page, Locator, expect } from '@playwright/test'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Base Page Object
 * Contains common elements and methods for all pages
 */
export abstract class BasePage {
  readonly page: Page
  readonly path: string

  // Common elements
  readonly header: Locator
  readonly sidebar: Locator
  readonly mainContent: Locator
  readonly mobileMenuButton: Locator
  readonly bottomNav: Locator
  readonly themeToggle: Locator
  readonly helpButton: Locator
  readonly loadingSpinner: Locator

  constructor(page: Page, path: string) {
    this.page = page
    this.path = path

    // Initialize common locators
    this.header = page.locator('header').first()
    this.sidebar = page.locator('aside').first()
    this.mainContent = page.locator('main').first()
    this.mobileMenuButton = page.locator('button[aria-label="Menu"]')
    this.bottomNav = page.locator('nav').last()
    this.themeToggle = page.locator('button[title*="Modo"]').first()
    this.helpButton = page.locator('button[aria-label*="ajuda"], button:has-text("?")').first()
    this.loadingSpinner = page.locator('.animate-spin')
  }

  /**
   * Navigate to this page
   */
  async goto() {
    await this.page.goto(this.path)
    await waitForPageStable(this.page)
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(500)
  }

  /**
   * Get page title heading
   */
  getTitle(): Locator {
    return this.page.locator('h1').first()
  }

  /**
   * Check if page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await expect(this.getTitle()).toBeVisible({ timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if loading
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSpinner.isVisible()
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete() {
    try {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 })
    } catch {
      // Loading spinner may not be visible
    }
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.page.url()
  }

  /**
   * Check if at expected URL
   */
  async isAtExpectedUrl(): Promise<boolean> {
    const url = this.getUrl()
    return url.endsWith(this.path) || url.includes(this.path)
  }

  /**
   * Toggle theme
   */
  async toggleTheme() {
    if (await this.themeToggle.isVisible()) {
      await this.themeToggle.click()
      await this.page.waitForTimeout(500)
    }
  }

  /**
   * Open help modal
   */
  async openHelp() {
    if (await this.helpButton.isVisible()) {
      await this.helpButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Check if on mobile viewport
   */
  isMobileViewport(): boolean {
    const viewport = this.page.viewportSize()
    return viewport ? viewport.width < 1024 : false
  }

  /**
   * Open mobile menu
   */
  async openMobileMenu() {
    if (this.isMobileViewport() && await this.mobileMenuButton.isVisible()) {
      await this.mobileMenuButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Navigate to a page via sidebar
   */
  async navigateTo(linkText: string) {
    if (this.isMobileViewport()) {
      await this.openMobileMenu()
    }
    await this.page.locator(`a:has-text("${linkText}")`).first().click()
    await waitForPageStable(this.page)
  }

  /**
   * Click primary action button (usually "Nova X" or "Adicionar")
   */
  async clickPrimaryAction() {
    const button = this.page.locator('button.btn-primary, button:has-text("Nova"), button:has-text("Adicionar"), button:has-text("+")').first()
    await button.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Get modal
   */
  getModal(): Locator {
    return this.page.locator('.fixed.inset-0.bg-black\\/50, [role="dialog"]').first()
  }

  /**
   * Check if modal is visible
   */
  async isModalVisible(): Promise<boolean> {
    return this.getModal().isVisible()
  }

  /**
   * Close modal
   */
  async closeModal() {
    const closeButton = this.page.locator('button:has-text("Cancelar"), button:has(svg[class*="lucide-x"])').first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Submit modal form
   */
  async submitModal() {
    const submitButton = this.page.locator('button:has-text("Salvar"), button:has-text("Criar"), button:has-text("Confirmar")').first()
    await submitButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Fill form input by label
   */
  async fillInput(label: string, value: string) {
    const input = this.page.locator(`label:has-text("${label}")`).locator('..').locator('input, textarea').first()
    await input.fill(value)
  }

  /**
   * Select option by label
   */
  async selectOption(label: string, optionText: string) {
    const select = this.page.locator(`label:has-text("${label}")`).locator('..').locator('select').first()
    await select.selectOption({ label: optionText })
  }

  /**
   * Get empty state
   */
  getEmptyState(): Locator {
    return this.page.locator('[class*="empty-state"], .text-center:has-text("Nenhum")')
  }

  /**
   * Check if showing empty state
   */
  async hasEmptyState(): Promise<boolean> {
    return this.getEmptyState().isVisible()
  }

  /**
   * Get all cards on page
   */
  getCards(): Locator {
    return this.page.locator('.card')
  }

  /**
   * Get card count
   */
  async getCardCount(): Promise<number> {
    return this.getCards().count()
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string) {
    await this.waitForLoad()
    await expect(this.page).toHaveScreenshot(name, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  }
}
