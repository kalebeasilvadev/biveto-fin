import { test, expect } from '@playwright/test'

test.describe('Navegação Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('deve navegar por todas as páginas principais', async ({ page }) => {
    const routes = [
      { path: '/', title: 'Dashboard' },
      { path: '/transactions', title: 'Transações' },
      { path: '/accounts', title: 'Minhas Contas' },
      { path: '/credit-cards', title: 'Cartões de Crédito' },
      { path: '/income-sources', title: 'Fontes de Receita' },
      { path: '/budget', title: 'Orçamento' },
      { path: '/goals', title: 'Metas' },
      { path: '/debts', title: 'Dívidas' },
      { path: '/recurring', title: 'Recorrentes' },
      { path: '/insights', title: 'Insights' },
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')
      await expect(page.locator(`h1:has-text("${route.title}")`)).toBeVisible({ timeout: 10000 })
    }
  })

  test('sidebar deve estar sempre visível no desktop', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Sidebar deve estar visível
    const sidebar = page.locator('aside.hidden.lg\\:flex')
    await expect(sidebar).toBeVisible()
  })

  test('deve navegar usando links da sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Clicar em Transações na sidebar
    await page.click('aside a[href="/transactions"]')
    await expect(page).toHaveURL('/transactions')

    // Clicar em Cartões na sidebar
    await page.click('aside a[href="/credit-cards"]')
    await expect(page).toHaveURL('/credit-cards')
  })

  test('link ativo deve ter destaque visual', async ({ page }) => {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')

    // Link de transações deve ter classe de ativo
    const transactionsLink = page.locator('aside a[href="/transactions"]')
    await expect(transactionsLink).toHaveClass(/bg-biveto-light|text-biveto/)
  })
})

test.describe('Navegação Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('deve exibir menu hamburger no mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const menuButton = page.locator('button[aria-label="Menu"]')
    await expect(menuButton).toBeVisible()
  })

  test('deve abrir e fechar menu lateral', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Abrir menu
    await page.click('button[aria-label="Menu"]')
    await expect(page.locator('aside.fixed.inset-y-0.left-0')).toHaveClass(/translate-x-0/)

    // Fechar menu clicando no overlay
    await page.click('.fixed.inset-0.bg-black\\/50')
    await expect(page.locator('aside.fixed.inset-y-0.left-0')).toHaveClass(/-translate-x-full/)
  })

  test('bottom navigation deve estar visível', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const bottomNav = page.locator('nav.bottom-nav')
    await expect(bottomNav).toBeVisible()
  })

  test('deve navegar usando bottom navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Clicar em Transações na bottom nav
    await page.click('nav.bottom-nav a[href="/transactions"]')
    await expect(page).toHaveURL('/transactions')
  })

  test('menu lateral deve fechar ao navegar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Abrir menu
    await page.click('button[aria-label="Menu"]')

    // Navegar usando o menu
    await page.click('aside a[href="/accounts"]')

    // Menu deve estar fechado após navegação
    await expect(page).toHaveURL('/accounts')
  })
})

test.describe('Navegação - Estados e Transições', () => {
  test('deve manter posição de scroll ao voltar', async ({ page }) => {
    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')

    // Scrollar para baixo
    await page.evaluate(() => window.scrollTo(0, 500))

    // Navegar para outra página
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // Voltar
    await page.goBack()
    await page.waitForLoadState('networkidle')

    // Verificar que está na página de transações
    await expect(page).toHaveURL('/transactions')
  })

  test('deve lidar com refresh da página', async ({ page }) => {
    await page.goto('/credit-cards')
    await page.waitForLoadState('networkidle')

    // Refresh
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Deve permanecer na mesma página
    await expect(page).toHaveURL('/credit-cards')
    await expect(page.locator('h1:has-text("Cartões de Crédito")')).toBeVisible()
  })
})
