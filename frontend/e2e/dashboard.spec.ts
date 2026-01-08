import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('deve exibir o dashboard corretamente', async ({ page }) => {
    await page.goto('/')

    // Verificar que a página carregou
    await expect(page).toHaveURL('/')

    // Verificar elementos principais
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('deve exibir cards de resumo', async ({ page }) => {
    await page.goto('/')

    // Aguardar cards carregarem
    await page.waitForLoadState('networkidle')

    // Verificar presença dos cards (podem ter diferentes labels dependendo do tema)
    const cards = page.locator('.card')
    await expect(cards.first()).toBeVisible()
  })

  test('deve navegar para transações ao clicar no menu', async ({ page }) => {
    await page.goto('/')

    // Clicar no link de transações
    await page.click('a[href="/transactions"]')

    // Verificar navegação
    await expect(page).toHaveURL('/transactions')
  })

  test('deve manter consistência visual no tema atual', async ({ page, browserName }, testInfo) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Screenshot para comparação visual
    await expect(page).toHaveScreenshot(`dashboard-${testInfo.project.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    })
  })
})

test.describe('Dashboard - Mobile Layout', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir menu mobile corretamente', async ({ page }) => {
    await page.goto('/')

    // Em mobile, deve haver um botão de menu
    const menuButton = page.locator('button[aria-label="Menu"]')
    await expect(menuButton).toBeVisible()
  })

  test('deve abrir sidebar mobile ao clicar no menu', async ({ page }) => {
    await page.goto('/')

    // Clicar no botão de menu
    await page.click('button[aria-label="Menu"]')

    // Verificar que a sidebar abriu
    await expect(page.locator('aside').first()).toBeVisible()
  })

  test('deve exibir bottom navigation no mobile', async ({ page }) => {
    await page.goto('/')

    // Verificar bottom nav
    const bottomNav = page.locator('nav.bottom-nav')
    await expect(bottomNav).toBeVisible()
  })
})
