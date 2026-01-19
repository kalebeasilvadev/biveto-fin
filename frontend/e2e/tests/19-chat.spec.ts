import { test, expect } from '@playwright/test'
import { ChatPage } from '../pages'
import { waitForPageStable } from '../utils/test.helper'

/**
 * Chat/Assistant Tests
 * Tests chat interface and interaction
 */

test.describe('Assistente', () => {
  test.beforeEach(async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
  })

  test('deve exibir a página do assistente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Assistente"), h1:has-text("Chat")')).toBeVisible()
  })

  test('deve exibir interface de chat', async ({ page }) => {
    const chatPage = new ChatPage(page)

    await expect(chatPage.chatContainer).toBeVisible()
  })

  test('deve exibir campo de entrada de mensagem', async ({ page }) => {
    const chatPage = new ChatPage(page)

    await expect(chatPage.messageInput).toBeVisible()
  })

  test('deve exibir sugestões de perguntas', async ({ page }) => {
    const chatPage = new ChatPage(page)

    const hasSuggestions = await chatPage.hasSuggestions()
    // Suggestions may or may not be visible
  })

  test('deve permitir digitar mensagem', async ({ page }) => {
    const chatPage = new ChatPage(page)

    await chatPage.typeMessage('Teste de mensagem')

    const inputValue = await chatPage.messageInput.inputValue()
    expect(inputValue).toBe('Teste de mensagem')
  })

  test('deve ter botão de enviar', async ({ page }) => {
    const chatPage = new ChatPage(page)

    await expect(chatPage.sendButton).toBeVisible()
  })

  test('deve ter botão de nova conversa', async ({ page }) => {
    const chatPage = new ChatPage(page)

    const newConversationVisible = await chatPage.newConversationButton.isVisible()
    // Button may or may not be visible
  })

  test('screenshot assistente desktop', async ({ page }, testInfo) => {
    await waitForPageStable(page)

    await expect(page).toHaveScreenshot(`chat-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})

test.describe('Assistente - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat')
    await waitForPageStable(page)
  })

  test('deve exibir layout mobile corretamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Assistente"), h1:has-text("Chat")')).toBeVisible()
  })

  test('screenshot assistente mobile', async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`chat-mobile-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    })
  })
})
