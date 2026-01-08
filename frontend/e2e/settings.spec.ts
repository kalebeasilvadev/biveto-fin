import { test, expect } from '@playwright/test'

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('deve exibir a página de configurações', async ({ page }) => {
    await expect(page.locator('h1:has-text("Configurações")')).toBeVisible()
  })

  test('deve exibir seção de conta', async ({ page }) => {
    await expect(page.locator('text=Conta')).toBeVisible()
  })

  test('deve exibir seção de família', async ({ page }) => {
    await expect(page.locator('text=Família')).toBeVisible()
  })

  test('deve exibir informações do usuário', async ({ page }) => {
    // Deve ter campo de email ou nome
    const userInfo = page.locator('text=@')
    await expect(userInfo.first()).toBeVisible()
  })

  test('deve ter link para gerenciar família', async ({ page }) => {
    const familyLink = page.locator('a[href="/family"]')
    await expect(familyLink).toBeVisible()
  })

  test('screenshot desktop', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`settings-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Configurações - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1:has-text("Configurações")')).toBeVisible()
  })

  test('screenshot mobile', async ({ page }, testInfo) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`settings-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Família', () => {
  test('deve acessar página de família', async ({ page }) => {
    await page.goto('/family')
    await page.waitForLoadState('networkidle')

    // Pode mostrar "Família" ou "Minha Familia" ou similar
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
  })

  test('screenshot desktop', async ({ page }, testInfo) => {
    await page.goto('/family')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`family-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})
