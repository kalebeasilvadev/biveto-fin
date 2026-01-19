import { test, expect } from '@playwright/test'
import { AccountsPage } from '../pages'
import { TEST_ACCOUNT } from '../fixtures/test-data'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Accounts Tests
 * Tests account listing, creation, editing, and deletion
 */

test.describe('Contas', () => {
  test.beforeEach(async ({ page }) => {
    const accountsPage = new AccountsPage(page)
    await accountsPage.goto()
  })

  test('deve exibir a página de contas', async ({ page }) => {
    await expect(page.locator('h1:has-text("Minhas Contas")')).toBeVisible()
  })

  test('deve exibir saldo total', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await expect(accountsPage.totalBalanceCard).toBeVisible()

    const balance = await accountsPage.getTotalBalance()
    expect(balance).toContain('R$')
  })

  test('deve exibir botão de nova conta', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await expect(accountsPage.newAccountButton.first()).toBeVisible()
  })

  test('deve abrir modal ao clicar em nova conta', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await accountsPage.clickNewAccount()

    // Modal should be visible
    await expect(accountsPage.modal).toBeVisible()
    await expect(page.locator('h2:has-text("Nova Conta")')).toBeVisible()
  })

  test('deve ter tipos de conta disponíveis', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await accountsPage.clickNewAccount()

    // Type select should be visible
    await expect(accountsPage.typeSelect).toBeVisible()

    // Check options
    await expect(page.locator('option:has-text("Banco")')).toBeAttached()
    await expect(page.locator('option:has-text("Carteira")')).toBeAttached()
    await expect(page.locator('option:has-text("Investimento")')).toBeAttached()
  })

  test('deve ter seletor de cores', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await accountsPage.clickNewAccount()

    // Color buttons should exist
    const colorCount = await accountsPage.colorButtons.count()
    expect(colorCount).toBeGreaterThan(0)
  })

  test('deve criar nova conta', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await accountsPage.createAccount({
      name: TEST_ACCOUNT.name,
      type: 'Carteira',
      balance: TEST_ACCOUNT.balance,
      colorIndex: 0,
    })

    // Modal should close
    await expect(accountsPage.modal).not.toBeVisible()

    // Account should appear in list
    await accountsPage.assertAccountExists(TEST_ACCOUNT.name)
  })

  test('deve editar conta existente', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    // First check if test account exists
    const exists = await accountsPage.accountExists(TEST_ACCOUNT.name)

    if (!exists) {
      // Create it first
      await accountsPage.createAccount({
        name: TEST_ACCOUNT.name,
        type: 'Carteira',
        balance: TEST_ACCOUNT.balance,
      })
    }

    // Click edit
    await accountsPage.clickEditAccount(TEST_ACCOUNT.name)

    // Modal should open with edit title
    await expect(page.locator('h2:has-text("Editar")')).toBeVisible()

    // Change name
    await accountsPage.fillName(TEST_ACCOUNT.nameEdited)
    await accountsPage.save()

    // Updated name should appear
    await accountsPage.assertAccountExists(TEST_ACCOUNT.nameEdited)
  })

  test('deve excluir conta', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    // Check if edited account exists, if not use original name
    let accountName = TEST_ACCOUNT.nameEdited
    if (!(await accountsPage.accountExists(accountName))) {
      accountName = TEST_ACCOUNT.name

      // Create if doesn't exist
      if (!(await accountsPage.accountExists(accountName))) {
        await accountsPage.createAccount({
          name: accountName,
          type: 'Carteira',
          balance: TEST_ACCOUNT.balance,
        })
      }
    }

    // Set up dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // Delete account
    await accountsPage.clickDeleteAccount(accountName)

    // Wait and verify it's gone
    await page.waitForTimeout(1000)
    await accountsPage.assertAccountNotExists(accountName)
  })

  test('deve validar campos obrigatórios', async ({ page }) => {
    const accountsPage = new AccountsPage(page)

    await accountsPage.clickNewAccount()

    // Try to save without filling required fields
    const saveButton = page.locator('button:has-text("Salvar")')

    // Button should be disabled without name
    await expect(saveButton).toBeDisabled()
  })

  test('screenshot contas desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`accounts-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Contas - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Minhas Contas")')).toBeVisible()
  })

  test('deve exibir botão de nova conta em mobile', async ({ page }) => {
    const accountsPage = new AccountsPage(page)
    await expect(accountsPage.newAccountButton.first()).toBeVisible()
  })

  test('grid deve ser responsivo', async ({ page }) => {
    // In mobile, grid should be single column
    const cards = page.locator('.card')
    const cardCount = await cards.count()

    if (cardCount > 0) {
      const firstCard = await cards.first().boundingBox()
      const viewport = page.viewportSize()

      // Card width should be close to viewport width (minus padding)
      if (firstCard && viewport) {
        expect(firstCard.width).toBeGreaterThan(viewport.width * 0.8)
      }
    }
  })

  test('screenshot contas mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`accounts-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
