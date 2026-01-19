import { Page, expect } from '@playwright/test'
import { TEST_CREDENTIALS, INVALID_CREDENTIALS } from '../fixtures/test-data'

/**
 * Authentication Helper Functions
 * Provides reusable authentication utilities for E2E tests
 */

/**
 * Login to the application
 */
export async function login(page: Page, email?: string, password?: string) {
  const credentials = {
    email: email || TEST_CREDENTIALS.email,
    password: password || TEST_CREDENTIALS.password,
  }

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Wait for login form
  await expect(page.locator('input[type="email"]')).toBeVisible()

  // Fill credentials
  await page.locator('input[type="email"]').fill(credentials.email)
  await page.locator('input[type="password"]').fill(credentials.password)

  // Submit form
  await page.click('button[type="submit"]')

  // Wait for navigation to dashboard
  await page.waitForURL('/', { timeout: 15000 })
}

/**
 * Logout from the application
 */
export async function logout(page: Page) {
  // Check if logged in
  const isLoggedIn = await page.evaluate(() => {
    return localStorage.getItem('auth-storage') !== null
  })

  if (!isLoggedIn) {
    return
  }

  // Check viewport to determine which logout button to use
  const viewport = page.viewportSize()
  const isMobile = viewport && viewport.width < 1024

  if (isMobile) {
    // Open mobile menu first
    const menuButton = page.locator('button[aria-label="Menu"]')
    if (await menuButton.isVisible()) {
      await menuButton.click()
      await page.waitForTimeout(300)
    }
  }

  // Click logout button
  const logoutButton = page.locator('button:has-text("Sair")').first()
  if (await logoutButton.isVisible()) {
    await logoutButton.click()
    await page.waitForURL('/login')
  }
}

/**
 * Ensure user is logged out (clear storage)
 */
export async function ensureLoggedOut(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('auth-storage')
    localStorage.removeItem('biveto-theme')
  })
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
}

/**
 * Check if user is currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const storage = localStorage.getItem('auth-storage')
    if (!storage) return false
    try {
      const parsed = JSON.parse(storage)
      return !!parsed?.state?.token
    } catch {
      return false
    }
  })
}

/**
 * Get current user info from localStorage
 */
export async function getCurrentUser(page: Page): Promise<{ email?: string; name?: string } | null> {
  return page.evaluate(() => {
    const storage = localStorage.getItem('auth-storage')
    if (!storage) return null
    try {
      const parsed = JSON.parse(storage)
      return parsed?.state?.user || null
    } catch {
      return null
    }
  })
}

/**
 * Try login with invalid credentials (for negative test cases)
 */
export async function loginWithInvalidCredentials(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.locator('input[type="email"]').fill(INVALID_CREDENTIALS.email)
  await page.locator('input[type="password"]').fill(INVALID_CREDENTIALS.password)

  await page.click('button[type="submit"]')

  // Wait for error message
  await page.waitForTimeout(2000)
}

/**
 * Wait for authentication state to be loaded
 */
export async function waitForAuthState(page: Page) {
  await page.waitForFunction(() => {
    const storage = localStorage.getItem('auth-storage')
    return storage !== null
  }, { timeout: 10000 })
}
