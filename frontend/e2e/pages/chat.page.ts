import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Chat Page Object
 */
export class ChatPage extends BasePage {
  // Chat interface
  readonly chatContainer: Locator
  readonly messagesList: Locator
  readonly messageInput: Locator
  readonly sendButton: Locator

  // Suggestions
  readonly suggestions: Locator

  // New conversation
  readonly newConversationButton: Locator

  // Loading state
  readonly loadingIndicator: Locator
  readonly typingIndicator: Locator

  constructor(page: Page) {
    super(page, '/chat')

    // Chat interface
    this.chatContainer = page.locator('.chat-container, main')
    this.messagesList = page.locator('.messages, .space-y-4')
    this.messageInput = page.locator('input[type="text"], textarea').last()
    this.sendButton = page.locator('button:has(svg[class*="send"]), button[type="submit"]')

    // Suggestions
    this.suggestions = page.locator('.suggestions, button.suggestion')

    // New conversation
    this.newConversationButton = page.locator('button:has-text("Nova Conversa"), button:has-text("Nova")')

    // Loading state
    this.loadingIndicator = page.locator('.loading, .animate-pulse')
    this.typingIndicator = page.locator('.typing, text=Digitando')
  }

  /**
   * Type message
   */
  async typeMessage(message: string) {
    await this.messageInput.fill(message)
  }

  /**
   * Send message
   */
  async sendMessage(message: string) {
    await this.typeMessage(message)
    await this.sendButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Wait for response
   */
  async waitForResponse(timeout = 30000) {
    // Wait for loading to appear and then disappear
    try {
      await this.loadingIndicator.waitFor({ state: 'visible', timeout: 2000 })
    } catch {
      // Loading might be too fast to catch
    }

    await this.loadingIndicator.waitFor({ state: 'hidden', timeout })
  }

  /**
   * Get all messages
   */
  async getAllMessages(): Promise<string[]> {
    const messages = this.messagesList.locator('.message, > div')
    return messages.allTextContents()
  }

  /**
   * Get last message
   */
  async getLastMessage(): Promise<string> {
    const messages = this.messagesList.locator('.message, > div')
    const count = await messages.count()
    if (count === 0) return ''
    const lastMessage = await messages.nth(count - 1).textContent()
    return lastMessage || ''
  }

  /**
   * Get last assistant message
   */
  async getLastAssistantMessage(): Promise<string> {
    const assistantMessages = this.page.locator('.assistant-message, .message-assistant')
    const count = await assistantMessages.count()
    if (count === 0) return ''
    const lastMessage = await assistantMessages.nth(count - 1).textContent()
    return lastMessage || ''
  }

  /**
   * Click suggestion
   */
  async clickSuggestion(text: string) {
    await this.page.locator(`button:has-text("${text}")`).first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Click first suggestion
   */
  async clickFirstSuggestion() {
    await this.suggestions.first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Start new conversation
   */
  async startNewConversation() {
    await this.newConversationButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    const messages = this.messagesList.locator('.message, > div')
    return messages.count()
  }

  /**
   * Check if suggestions are visible
   */
  async hasSuggestions(): Promise<boolean> {
    return this.suggestions.first().isVisible()
  }

  /**
   * Get all suggestions
   */
  async getAllSuggestions(): Promise<string[]> {
    return this.suggestions.allTextContents()
  }

  /**
   * Check if loading
   */
  async isLoading(): Promise<boolean> {
    return this.loadingIndicator.isVisible()
  }

  /**
   * Send message and wait for response
   */
  async askQuestion(question: string): Promise<string> {
    await this.sendMessage(question)
    await this.waitForResponse()
    return this.getLastAssistantMessage()
  }

  /**
   * Assert response received
   */
  async assertResponseReceived() {
    const count = await this.getMessageCount()
    expect(count).toBeGreaterThan(1)
  }

  /**
   * Assert suggestions visible
   */
  async assertSuggestionsVisible() {
    await expect(this.suggestions.first()).toBeVisible()
  }

  /**
   * Assert chat is empty
   */
  async assertChatEmpty() {
    const count = await this.getMessageCount()
    expect(count).toBe(0)
  }
}
