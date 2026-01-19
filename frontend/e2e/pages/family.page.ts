import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Family Page Object
 */
export class FamilyPage extends BasePage {
  // Plan info
  readonly planCard: Locator
  readonly memberCount: Locator
  readonly maxMembers: Locator

  // Members list
  readonly membersList: Locator
  readonly memberCards: Locator

  // Pending invites
  readonly pendingInvitesList: Locator
  readonly pendingInviteCards: Locator

  // Actions
  readonly inviteButton: Locator

  // Invite modal
  readonly inviteModal: Locator
  readonly emailInput: Locator
  readonly sendInviteButton: Locator
  readonly cancelButton: Locator

  constructor(page: Page) {
    super(page, '/family')

    // Plan info
    this.planCard = page.locator('.card:has-text("Plano"), .card:has-text("Família")')
    this.memberCount = page.locator('text=membros').locator('..')
    this.maxMembers = page.locator('text=máximo').locator('..')

    // Members list
    this.membersList = page.locator('.members, .divide-y')
    this.memberCards = page.locator('.member-card, .card:has-text("@")')

    // Pending invites
    this.pendingInvitesList = page.locator('.pending, :has-text("Pendente")')
    this.pendingInviteCards = page.locator('.invite-card, .card:has-text("Pendente")')

    // Actions
    this.inviteButton = page.locator('button:has-text("Convidar"), button:has-text("Adicionar")')

    // Invite modal
    this.inviteModal = page.locator('.fixed.inset-0.bg-black\\/50')
    this.emailInput = page.locator('input[type="email"]')
    this.sendInviteButton = page.locator('button:has-text("Enviar")')
    this.cancelButton = page.locator('button:has-text("Cancelar")')
  }

  /**
   * Get member count
   */
  async getMemberCount(): Promise<number> {
    const text = await this.memberCount.textContent()
    const match = text?.match(/(\d+)/)
    return parseInt(match?.[1] || '0', 10)
  }

  /**
   * Get max members
   */
  async getMaxMembers(): Promise<number> {
    const text = await this.maxMembers.textContent()
    const match = text?.match(/(\d+)/)
    return parseInt(match?.[1] || '0', 10)
  }

  /**
   * Click invite member button
   */
  async clickInvite() {
    await this.inviteButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Fill email
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email)
  }

  /**
   * Send invite
   */
  async sendInvite() {
    await this.sendInviteButton.click()
    await this.page.waitForTimeout(500)
  }

  /**
   * Cancel invite
   */
  async cancel() {
    await this.cancelButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Invite member
   */
  async inviteMember(email: string) {
    await this.clickInvite()
    await this.fillEmail(email)
    await this.sendInvite()
  }

  /**
   * Get pending invite by email
   */
  getPendingInvite(email: string): Locator {
    return this.page.locator(`.card:has-text("${email}")`)
  }

  /**
   * Check if invite exists
   */
  async pendingInviteExists(email: string): Promise<boolean> {
    return this.getPendingInvite(email).isVisible()
  }

  /**
   * Cancel pending invite
   */
  async cancelPendingInvite(email: string) {
    const invite = this.getPendingInvite(email)
    await invite.locator('button:has-text("Cancelar")').click()
    // Handle confirmation
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Get all member emails
   */
  async getAllMemberEmails(): Promise<string[]> {
    const members = this.memberCards.locator('.text-gray-500, .email')
    return members.allTextContents()
  }

  /**
   * Get all pending invite emails
   */
  async getAllPendingEmails(): Promise<string[]> {
    const emails = this.pendingInviteCards.locator('.text-gray-500, .email')
    return emails.allTextContents()
  }

  /**
   * Check if can add more members
   */
  async canAddMoreMembers(): Promise<boolean> {
    const current = await this.getMemberCount()
    const max = await this.getMaxMembers()
    return current < max
  }

  /**
   * Remove member
   */
  async removeMember(email: string) {
    const member = this.page.locator(`.card:has-text("${email}")`)
    await member.locator('button:has-text("Remover")').click()
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await this.page.waitForTimeout(500)
  }

  /**
   * Assert member exists
   */
  async assertMemberExists(email: string) {
    const member = this.page.locator(`.card:has-text("${email}")`)
    await expect(member).toBeVisible()
  }

  /**
   * Assert pending invite exists
   */
  async assertPendingInviteExists(email: string) {
    await expect(this.getPendingInvite(email)).toBeVisible()
  }

  /**
   * Assert pending invite doesn't exist
   */
  async assertPendingInviteNotExists(email: string) {
    await expect(this.getPendingInvite(email)).not.toBeVisible()
  }
}
