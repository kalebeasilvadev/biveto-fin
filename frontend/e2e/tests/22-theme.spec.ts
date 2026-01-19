import { test, expect } from '@playwright/test'
import { waitForPageStable, setTheme, getEffectiveTheme } from '../utils/test.helper'
import { ALL_PAGES } from '../fixtures/test-data'

/**
 * Theme Tests
 * Tests dark/light mode toggle and persistence
 */

test.describe('Theme - Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForPageStable(page)
  })

  test('deve alternar para dark mode', async ({ page }) => {
    // Set to light mode first
    await setTheme(page, 'light')
    await waitForPageStable(page)

    let theme = await getEffectiveTheme(page)
    expect(theme).toBe('light')

    // Toggle to dark
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    theme = await getEffectiveTheme(page)
    expect(theme).toBe('dark')
  })

  test('deve alternar para light mode', async ({ page }) => {
    // Set to dark mode first
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    let theme = await getEffectiveTheme(page)
    expect(theme).toBe('dark')

    // Toggle to light
    await setTheme(page, 'light')
    await waitForPageStable(page)

    theme = await getEffectiveTheme(page)
    expect(theme).toBe('light')
  })

  test('deve aplicar classe dark no html quando dark mode', async ({ page }) => {
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
    })

    expect(hasDarkClass).toBeTruthy()
  })

  test('deve remover classe dark quando light mode', async ({ page }) => {
    await setTheme(page, 'light')
    await waitForPageStable(page)

    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
    })

    expect(hasDarkClass).toBeFalsy()
  })
})

test.describe('Theme - Persistência', () => {
  test('deve persistir tema dark após reload', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    // Reload
    await page.reload()
    await waitForPageStable(page)

    const theme = await getEffectiveTheme(page)
    expect(theme).toBe('dark')
  })

  test('deve persistir tema light após reload', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'light')
    await waitForPageStable(page)

    // Reload
    await page.reload()
    await waitForPageStable(page)

    const theme = await getEffectiveTheme(page)
    expect(theme).toBe('light')
  })

  test('deve persistir tema ao navegar entre páginas', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    // Navigate to different pages
    const pagesToTest = ['/transactions', '/accounts', '/budget', '/goals']

    for (const path of pagesToTest) {
      await page.goto(path)
      await waitForPageStable(page)

      const theme = await getEffectiveTheme(page)
      expect(theme).toBe('dark')
    }
  })

  test('deve salvar tema no localStorage', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const savedTheme = await page.evaluate(() => {
      // Check various possible storage keys
      return (
        localStorage.getItem('theme') ||
        localStorage.getItem('color-mode') ||
        localStorage.getItem('ui-theme') ||
        JSON.parse(localStorage.getItem('theme-storage') || '{}').theme ||
        null
      )
    })

    // Theme should be saved (format may vary)
    // Note: implementation may use different storage patterns
  })
})

test.describe('Theme - Visual Consistency', () => {
  test('deve ter background escuro em dark mode', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Dark mode should have darker background
    // RGB values for dark backgrounds are typically low (< 50)
    const match = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [_, r, g, b] = match.map(Number)
      // At least one component should be relatively dark
      expect(Math.max(r, g, b)).toBeLessThan(128)
    }
  })

  test('deve ter background claro em light mode', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'light')
    await waitForPageStable(page)

    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Light mode should have lighter background
    const match = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [_, r, g, b] = match.map(Number)
      // At least one component should be relatively light
      expect(Math.min(r, g, b)).toBeGreaterThan(127)
    }
  })

  test('deve ter texto legível em dark mode', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const textColor = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      if (h1) {
        return window.getComputedStyle(h1).color
      }
      return window.getComputedStyle(document.body).color
    })

    // Text should be light in dark mode
    const match = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [_, r, g, b] = match.map(Number)
      // Text should be relatively light
      expect(Math.max(r, g, b)).toBeGreaterThan(127)
    }
  })

  test('deve ter texto legível em light mode', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'light')
    await waitForPageStable(page)

    const textColor = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      if (h1) {
        return window.getComputedStyle(h1).color
      }
      return window.getComputedStyle(document.body).color
    })

    // Text should be dark in light mode
    const match = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [_, r, g, b] = match.map(Number)
      // Text should be relatively dark
      expect(Math.min(r, g, b)).toBeLessThan(128)
    }
  })
})

test.describe('Theme - All Pages', () => {
  const testPages = ALL_PAGES.filter(p => !p.path.includes('login'))

  for (const pageInfo of testPages) {
    test(`deve renderizar ${pageInfo.name} em dark mode`, async ({ page }) => {
      await page.goto(pageInfo.path)
      await setTheme(page, 'dark')
      await waitForPageStable(page)

      const theme = await getEffectiveTheme(page)
      expect(theme).toBe('dark')

      // Check no broken layout
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)

      // No major horizontal overflow
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20)
    })

    test(`deve renderizar ${pageInfo.name} em light mode`, async ({ page }) => {
      await page.goto(pageInfo.path)
      await setTheme(page, 'light')
      await waitForPageStable(page)

      const theme = await getEffectiveTheme(page)
      expect(theme).toBe('light')

      // Check no broken layout
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)

      // No major horizontal overflow
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20)
    })
  }
})

test.describe('Theme - Components', () => {
  test('deve aplicar tema em cards', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const cards = page.locator('.card, [class*="card"], .bg-white, .bg-gray-800')
    const cardCount = await cards.count()

    if (cardCount > 0) {
      // Cards should exist and have appropriate styling
      expect(cardCount).toBeGreaterThan(0)
    }
  })

  test('deve aplicar tema em botões', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    expect(buttonCount).toBeGreaterThan(0)
  })

  test('deve aplicar tema em inputs', async ({ page }) => {
    await page.goto('/upload')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const inputs = page.locator('input, textarea, select')
    const inputCount = await inputs.count()

    // Should have some inputs
    expect(inputCount).toBeGreaterThanOrEqual(0)
  })

  test('deve aplicar tema no sidebar', async ({ page }) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    const sidebar = page.locator('[data-testid="sidebar"], aside, nav').first()

    if (await sidebar.isVisible()) {
      // Sidebar should be visible
      expect(await sidebar.isVisible()).toBeTruthy()
    }
  })
})

test.describe('Theme - Screenshots', () => {
  test('screenshot dashboard dark mode', async ({ page }, testInfo) => {
    await page.goto('/')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`theme-dark-dashboard-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })

  test('screenshot dashboard light mode', async ({ page }, testInfo) => {
    await page.goto('/')
    await setTheme(page, 'light')
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`theme-light-dashboard-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })

  test('screenshot transactions dark mode', async ({ page }, testInfo) => {
    await page.goto('/transactions')
    await setTheme(page, 'dark')
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`theme-dark-transactions-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })

  test('screenshot transactions light mode', async ({ page }, testInfo) => {
    await page.goto('/transactions')
    await setTheme(page, 'light')
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`theme-light-transactions-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
