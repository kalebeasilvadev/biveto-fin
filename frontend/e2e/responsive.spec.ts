import { test, expect, Page } from '@playwright/test'

/**
 * Testes de Responsividade
 *
 * Valida que o layout funciona corretamente em múltiplos viewports
 * sem overflow horizontal e com elementos acessíveis.
 */

// Viewports para testar (conforme requisitos)
const viewports = [
  { name: 'mobile-small', width: 360, height: 800 },
  { name: 'mobile-medium', width: 390, height: 844 },
  { name: 'mobile-large', width: 412, height: 915 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
]

// Páginas principais para testar
const pages = [
  { path: '/', name: 'dashboard' },
  { path: '/transactions', name: 'transactions' },
  { path: '/accounts', name: 'accounts' },
  { path: '/credit-cards', name: 'credit-cards' },
  { path: '/invoices', name: 'invoices' },
  { path: '/income-sources', name: 'income-sources' },
  { path: '/budget', name: 'budget' },
  { path: '/goals', name: 'goals' },
  { path: '/debts', name: 'debts' },
  { path: '/recurring', name: 'recurring' },
  { path: '/settings', name: 'settings' },
]

/**
 * Helper para verificar ausência de overflow horizontal
 */
async function checkNoHorizontalOverflow(page: Page): Promise<{ hasOverflow: boolean; details: string }> {
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
 * Helper para aguardar página estabilizar
 */
async function waitForPageStable(page: Page) {
  await page.waitForLoadState('networkidle')
  // Aguarda animações CSS terminarem
  await page.waitForTimeout(500)
}

test.describe('Responsividade - Overflow Horizontal', () => {
  for (const viewport of viewports) {
    test.describe(`Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
      })

      for (const pageConfig of pages) {
        test(`${pageConfig.name} não deve ter overflow horizontal`, async ({ page }) => {
          await page.goto(pageConfig.path)
          await waitForPageStable(page)

          const overflow = await checkNoHorizontalOverflow(page)

          expect(overflow.hasOverflow, `Overflow detectado em ${pageConfig.name}: ${overflow.details}`).toBe(false)
        })
      }
    })
  }
})

test.describe('Responsividade - Navegação Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Viewport mobile
    await page.setViewportSize({ width: 360, height: 800 })
  })

  test('menu hamburger deve estar visível em mobile', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Botão de menu deve estar visível
    const menuButton = page.locator('button[aria-label="Menu"], button:has-text("Menu")').first()
    await expect(menuButton).toBeVisible()
  })

  test('sidebar deve abrir ao clicar no menu', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Clicar no menu
    const menuButton = page.locator('button[aria-label="Menu"], button:has-text("Menu")').first()
    await menuButton.click()

    // Sidebar deve aparecer
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
  })

  test('bottom navigation deve estar visível em mobile', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Bottom nav deve estar visível
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeVisible()

    // Deve ter os itens principais
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /transações/i })).toBeVisible()
  })

  test('deve navegar entre páginas via bottom nav', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Navegar para transações via bottom nav
    await page.getByRole('link', { name: /transações/i }).click()
    await page.waitForURL('/transactions')

    expect(page.url()).toContain('/transactions')
  })
})

test.describe('Responsividade - Layout Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Viewport desktop
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('sidebar deve estar fixa em desktop', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Sidebar deve estar visível
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    // Menu hamburger não deve estar visível
    const menuButton = page.locator('button[aria-label="Menu"]')
    await expect(menuButton).not.toBeVisible()
  })

  test('bottom navigation não deve estar visível em desktop', async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)

    // Verificar que a bottom nav tem classe lg:hidden
    const bottomNav = page.locator('.bottom-nav')
    const isHidden = await bottomNav.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return computed.display === 'none'
    })

    expect(isHidden).toBe(true)
  })
})

test.describe('Responsividade - Screenshots Visuais', () => {
  // Retry adicional para visual tests (reduzir flakiness)
  test.describe.configure({ retries: 2 })

  for (const viewport of viewports.filter((v) => v.name.includes('mobile') || v.name === 'desktop')) {
    test(`screenshot dashboard - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await waitForPageStable(page)

      // Mascarar elementos dinâmicos (datas, valores que mudam)
      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`, {
        fullPage: false,
        mask: [
          page.locator('text=/R\\$\\s*[\\d.,]+/'), // Valores monetários
          page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/'), // Datas
          page.locator('text=/janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i'), // Meses
        ],
        maxDiffPixelRatio: 0.15,
      })
    })

    test(`screenshot transações - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/transactions')
      await waitForPageStable(page)

      await expect(page).toHaveScreenshot(`transactions-${viewport.name}.png`, {
        fullPage: false,
        mask: [
          page.locator('text=/R\\$\\s*[\\d.,]+/'),
          page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/'),
        ],
        maxDiffPixelRatio: 0.15,
      })
    })
  }
})

test.describe('Responsividade - Tabelas com Scroll', () => {
  test('tabela de transações deve ter scroll horizontal em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/transactions')
    await waitForPageStable(page)

    // Container da tabela deve ter overflow-x-auto
    const tableContainer = page.locator('table').locator('..')
    const hasScrollableContainer = await tableContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return computed.overflowX === 'auto' || computed.overflowX === 'scroll'
    })

    expect(hasScrollableContainer).toBe(true)
  })

  test('tabela de faturas deve ter scroll horizontal em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/invoices')
    await waitForPageStable(page)

    // Container da tabela deve ter overflow-x-auto
    const tableContainer = page.locator('table').locator('..')
    const hasScrollableContainer = await tableContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return computed.overflowX === 'auto' || computed.overflowX === 'scroll'
    })

    expect(hasScrollableContainer).toBe(true)
  })
})
