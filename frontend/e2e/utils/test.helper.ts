import { Page, expect, Locator } from '@playwright/test'

/**
 * Test Helper Functions
 * Provides reusable utilities for E2E tests
 */

/**
 * Wait for page to stabilize (network idle + animations)
 */
export async function waitForPageStable(page: Page, timeout = 500) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(timeout)
}

/**
 * Get effective theme from the page
 */
export async function getEffectiveTheme(page: Page): Promise<'light' | 'dark'> {
  return page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })
}

/**
 * Set theme programmatically
 */
export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('biveto-theme', JSON.stringify({ state: { theme: t }, version: 0 }))
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, theme)
}

/**
 * Toggle theme via UI button
 */
export async function clickThemeToggle(page: Page) {
  const themeToggle = page.locator('button[title*="Modo"]').first()
  if (await themeToggle.isVisible()) {
    await themeToggle.click()
    await page.waitForTimeout(500)
  }
}

/**
 * Check for horizontal overflow (should be none)
 */
export async function checkNoHorizontalOverflow(page: Page): Promise<{ hasOverflow: boolean; details: string }> {
  const result = await page.evaluate(() => {
    const body = document.body
    const html = document.documentElement
    const hasOverflow = body.scrollWidth > body.clientWidth || html.scrollWidth > html.clientWidth
    return {
      hasOverflow,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
    }
  })

  return {
    hasOverflow: result.hasOverflow,
    details: `Body: ${result.bodyScrollWidth}x${result.bodyClientWidth}, HTML: ${result.htmlScrollWidth}x${result.htmlClientWidth}`,
  }
}

/**
 * Open mobile menu
 */
export async function openMobileMenu(page: Page) {
  const menuButton = page.locator('button[aria-label="Menu"]')
  if (await menuButton.isVisible()) {
    await menuButton.click()
    await page.waitForTimeout(300)
  }
}

/**
 * Close mobile menu
 */
export async function closeMobileMenu(page: Page) {
  // Click on overlay or close button
  const closeButton = page.locator('button[aria-label="Menu"]').filter({ hasText: 'X' })
  const overlay = page.locator('.fixed.inset-0.bg-black\\/50')

  if (await closeButton.isVisible()) {
    await closeButton.click()
  } else if (await overlay.isVisible()) {
    await overlay.click()
  }
  await page.waitForTimeout(300)
}

/**
 * Navigate to page and wait for load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await waitForPageStable(page)
}

/**
 * Navigate via sidebar (desktop)
 */
export async function navigateViaSidebar(page: Page, linkText: string) {
  const link = page.locator(`aside a:has-text("${linkText}")`).first()
  await link.click()
  await waitForPageStable(page)
}

/**
 * Navigate via bottom nav (mobile)
 */
export async function navigateViaBottomNav(page: Page, linkText: string) {
  const link = page.locator(`nav a:has-text("${linkText}")`).last()
  await link.click()
  await waitForPageStable(page)
}

/**
 * Fill form field by label
 */
export async function fillFieldByLabel(page: Page, label: string, value: string) {
  const input = page.locator(`label:has-text("${label}") + input, label:has-text("${label}") ~ input`).first()
  await input.fill(value)
}

/**
 * Select option by label
 */
export async function selectOptionByLabel(page: Page, label: string, optionText: string) {
  const select = page.locator(`label:has-text("${label}") + select, label:has-text("${label}") ~ select`).first()
  await select.selectOption({ label: optionText })
}

/**
 * Click button by text
 */
export async function clickButton(page: Page, text: string) {
  await page.locator(`button:has-text("${text}")`).first().click()
}

/**
 * Expect modal to be visible
 */
export async function expectModalVisible(page: Page, titleText?: string) {
  const modal = page.locator('.fixed.inset-0, [role="dialog"]').first()
  await expect(modal).toBeVisible()

  if (titleText) {
    await expect(page.locator(`h2:has-text("${titleText}")`)).toBeVisible()
  }
}

/**
 * Close modal
 */
export async function closeModal(page: Page) {
  // Try close button first
  const closeButton = page.locator('button:has-text("Cancelar"), button[aria-label="Fechar"], .modal button:has(svg)').first()
  if (await closeButton.isVisible()) {
    await closeButton.click()
  }
  await page.waitForTimeout(300)
}

/**
 * Confirm dialog
 */
export async function confirmDialog(page: Page) {
  // Handle native confirm dialogs
  page.on('dialog', async dialog => {
    await dialog.accept()
  })
}

/**
 * Format currency (Brazilian format)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^\d,-]/g, '').replace(',', '.'))
}

/**
 * Get current date formatted
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get date N days from now
 */
export function getDateFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, text?: string) {
  const toastLocator = text
    ? page.locator(`[role="alert"]:has-text("${text}")`)
    : page.locator('[role="alert"]')

  await expect(toastLocator.first()).toBeVisible({ timeout: 5000 })
}

/**
 * Expect toast success message
 */
export async function expectToastSuccess(page: Page, message?: string) {
  const toast = page.locator('.toast-success, [role="alert"]').filter({ hasText: message || '' })
  await expect(toast.first()).toBeVisible({ timeout: 5000 })
}

/**
 * Expect toast error message
 */
export async function expectToastError(page: Page, message?: string) {
  const toast = page.locator('.toast-error, [role="alert"]').filter({ hasText: message || '' })
  await expect(toast.first()).toBeVisible({ timeout: 5000 })
}

/**
 * Get table row count
 */
export async function getTableRowCount(page: Page, tableLocator?: Locator): Promise<number> {
  const table = tableLocator || page.locator('table tbody')
  const rows = table.locator('tr')
  return rows.count()
}

/**
 * Get card count
 */
export async function getCardCount(page: Page): Promise<number> {
  const cards = page.locator('.card')
  return cards.count()
}

/**
 * Take screenshot with stable page
 */
export async function takeStableScreenshot(page: Page, name: string, options = {}) {
  await waitForPageStable(page)
  await expect(page).toHaveScreenshot(name, {
    fullPage: false,
    mask: [
      page.locator('text=/R\\$\\s*[\\d.,]+/'),
      page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/'),
    ],
    maxDiffPixelRatio: 0.15,
    ...options,
  })
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, locator: Locator): Promise<boolean> {
  const boundingBox = await locator.boundingBox()
  if (!boundingBox) return false

  const viewport = page.viewportSize()
  if (!viewport) return false

  return (
    boundingBox.x >= 0 &&
    boundingBox.y >= 0 &&
    boundingBox.x + boundingBox.width <= viewport.width &&
    boundingBox.y + boundingBox.height <= viewport.height
  )
}

/**
 * Scroll to element
 */
export async function scrollToElement(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
}

/**
 * Get all form validation errors
 */
export async function getFormErrors(page: Page): Promise<string[]> {
  const errors = await page.locator('.text-red-500, .text-red-600, .error-message').allTextContents()
  return errors.filter(e => e.trim() !== '')
}

/**
 * Check if button is disabled
 */
export async function isButtonDisabled(page: Page, buttonText: string): Promise<boolean> {
  const button = page.locator(`button:has-text("${buttonText}")`).first()
  return button.isDisabled()
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(response => {
    const url = response.url()
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern)
    }
    return urlPattern.test(url)
  })
}

/**
 * Mock API response
 */
export async function mockApiResponse(page: Page, urlPattern: string | RegExp, response: unknown) {
  await page.route(urlPattern, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

/**
 * Generate unique test identifier
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
}
