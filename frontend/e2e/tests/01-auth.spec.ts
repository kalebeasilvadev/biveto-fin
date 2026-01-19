import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages'
import { TEST_CREDENTIALS, INVALID_CREDENTIALS } from '../fixtures/test-data'
import { ensureLoggedOut, isLoggedIn, logout } from '../utils/auth.helper'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Authentication Tests
 * Tests login, logout, and validation flows
 */

test.describe('Autenticação', () => {
  test.describe('Logout', () => {
    test('deve fazer logout se estiver logado', async ({ page }) => {
      await page.goto('/')

      // Check if logged in
      const loggedIn = await isLoggedIn(page)

      if (loggedIn) {
        // Find logout button
        const logoutButton = page.locator('button:has-text("Sair")').first()

        if (await logoutButton.isVisible()) {
          await logoutButton.click()
          await page.waitForURL('/login')
        }
      }

      // Should be on login page
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
      await ensureLoggedOut(page)
    })

    test('deve exibir página de login corretamente', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Check form elements
      await expect(loginPage.emailInput).toBeVisible()
      await expect(loginPage.passwordInput).toBeVisible()
      await expect(loginPage.submitButton).toBeVisible()
      await expect(loginPage.logo).toBeVisible()
    })

    test('deve fazer login com credenciais válidas', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Fill credentials
      await loginPage.fillEmail(TEST_CREDENTIALS.email)
      await loginPage.fillPassword(TEST_CREDENTIALS.password)
      await loginPage.submit()

      // Wait for redirect to dashboard
      await loginPage.expectRedirectToDashboard()

      // Verify token is in localStorage
      const hasToken = await page.evaluate(() => {
        const storage = localStorage.getItem('auth-storage')
        if (!storage) return false
        const parsed = JSON.parse(storage)
        return !!parsed?.state?.token
      })
      expect(hasToken).toBe(true)

      // Verify user name appears
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Fill invalid credentials
      await loginPage.fillEmail(INVALID_CREDENTIALS.email)
      await loginPage.fillPassword(INVALID_CREDENTIALS.password)
      await loginPage.submit()

      // Wait for error
      await page.waitForTimeout(2000)

      // Should stay on login page
      await loginPage.expectStayOnLogin()

      // Should show error message
      const errorVisible = await loginPage.hasError()
      if (!errorVisible) {
        // Check for toast error
        const toast = page.locator('[role="alert"], .toast-error')
        await expect(toast.first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('deve validar campo de email vazio', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Leave email empty, fill password
      await loginPage.fillPassword(TEST_CREDENTIALS.password)
      await loginPage.submit()

      // Should stay on login
      await loginPage.expectStayOnLogin()
    })

    test('deve validar campo de senha vazio', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Fill email, leave password empty
      await loginPage.fillEmail(TEST_CREDENTIALS.email)
      await loginPage.submit()

      // Should stay on login
      await loginPage.expectStayOnLogin()
    })

    test('deve validar formato de email inválido', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()

      // Fill invalid email format
      await loginPage.fillEmail('email-invalido')
      await loginPage.fillPassword(TEST_CREDENTIALS.password)

      // Check HTML5 validation
      const isValid = await loginPage.isEmailValid()
      expect(isValid).toBe(false)
    })

    test('deve redirecionar para dashboard se já autenticado', async ({ page }) => {
      // First login
      const loginPage = new LoginPage(page)
      await loginPage.goto()
      await loginPage.loginWithTestCredentials()

      // Try to access login page again
      await page.goto('/login')

      // Should redirect to dashboard
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Sessão', () => {
    test('deve manter sessão após reload', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()
      await loginPage.loginWithTestCredentials()

      // Reload page
      await page.reload()
      await waitForPageStable(page)

      // Should still be on dashboard
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('deve manter sessão ao navegar entre páginas', async ({ page }) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()
      await loginPage.loginWithTestCredentials()

      // Navigate to different pages
      await page.goto('/transactions')
      await expect(page).toHaveURL('/transactions')

      await page.goto('/accounts')
      await expect(page).toHaveURL('/accounts')

      // Back to dashboard
      await page.goto('/')
      await expect(page).toHaveURL('/')
    })
  })
})

test.describe('Autenticação - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir formulário de login responsivo', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()

    // Inputs should be properly sized for mobile
    const emailBox = await loginPage.emailInput.boundingBox()
    expect(emailBox?.width).toBeGreaterThan(200)
  })

  test('deve fazer login em mobile', async ({ page }) => {
    await ensureLoggedOut(page)

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.loginWithTestCredentials()

    await expect(page).toHaveURL('/')
  })
})
