import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Insights Page Object
 */
export class InsightsPage extends BasePage {
  // Insights list
  readonly insightsList: Locator
  readonly insightCards: Locator

  // Insight types
  readonly leakageInsights: Locator
  readonly mainExpenseInsights: Locator
  readonly opportunityInsights: Locator
  readonly anomalyInsights: Locator

  // Insight card elements
  readonly insightTitle: Locator
  readonly insightDescription: Locator
  readonly insightImpact: Locator
  readonly insightAction: Locator

  constructor(page: Page) {
    super(page, '/insights')

    // Insights list
    this.insightsList = page.locator('.space-y-4, .divide-y, .grid')
    this.insightCards = page.locator('.card, .insight-card')

    // Insight types (by badge/tag)
    this.leakageInsights = page.locator('.card:has-text("Vazamento")')
    this.mainExpenseInsights = page.locator('.card:has-text("Principal")')
    this.opportunityInsights = page.locator('.card:has-text("Oportunidade")')
    this.anomalyInsights = page.locator('.card:has-text("Anomalia")')

    // Card elements
    this.insightTitle = page.locator('.insight-title, .card h3')
    this.insightDescription = page.locator('.insight-description, .card p')
    this.insightImpact = page.locator('.insight-impact, text=Impacto')
    this.insightAction = page.locator('.insight-action, button:has-text("Ação")')
  }

  /**
   * Get insight count
   */
  async getInsightCount(): Promise<number> {
    return this.insightCards.count()
  }

  /**
   * Get leakage insight count
   */
  async getLeakageCount(): Promise<number> {
    return this.leakageInsights.count()
  }

  /**
   * Get main expense insight count
   */
  async getMainExpenseCount(): Promise<number> {
    return this.mainExpenseInsights.count()
  }

  /**
   * Get opportunity insight count
   */
  async getOpportunityCount(): Promise<number> {
    return this.opportunityInsights.count()
  }

  /**
   * Get anomaly insight count
   */
  async getAnomalyCount(): Promise<number> {
    return this.anomalyInsights.count()
  }

  /**
   * Get all insight titles
   */
  async getAllInsightTitles(): Promise<string[]> {
    return this.insightTitle.allTextContents()
  }

  /**
   * Get insight by title
   */
  getInsight(title: string): Locator {
    return this.page.locator(`.card:has-text("${title}")`)
  }

  /**
   * Get insight type
   */
  async getInsightType(title: string): Promise<string> {
    const insight = this.getInsight(title)
    const badge = insight.locator('.badge, .tag, .px-2.py-1.rounded')
    const text = await badge.textContent()
    return text || ''
  }

  /**
   * Get insight impact value
   */
  async getInsightImpact(title: string): Promise<string> {
    const insight = this.getInsight(title)
    const impact = insight.locator('.text-expense, .font-bold')
    const text = await impact.textContent()
    return text || ''
  }

  /**
   * Click insight action
   */
  async clickInsightAction(title: string) {
    const insight = this.getInsight(title)
    await insight.locator('button').first().click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if insights are loaded
   */
  async hasInsights(): Promise<boolean> {
    return (await this.getInsightCount()) > 0
  }

  /**
   * Check if showing empty state
   */
  async isShowingEmptyState(): Promise<boolean> {
    return this.page.locator('text=Nenhum insight').isVisible()
  }

  /**
   * Check if showing loading
   */
  async isLoading(): Promise<boolean> {
    return this.page.locator('.animate-spin, .loading').isVisible()
  }

  /**
   * Get insights by type
   */
  async getInsightsByType(type: 'Vazamento' | 'Principal' | 'Oportunidade' | 'Anomalia'): Promise<string[]> {
    const insights = this.page.locator(`.card:has-text("${type}")`)
    const count = await insights.count()
    const titles: string[] = []

    for (let i = 0; i < count; i++) {
      const title = await insights.nth(i).locator('h3, .font-medium').textContent()
      if (title) titles.push(title)
    }

    return titles
  }

  /**
   * Assert has insights
   */
  async assertHasInsights() {
    const count = await this.getInsightCount()
    expect(count).toBeGreaterThan(0)
  }

  /**
   * Assert insight exists
   */
  async assertInsightExists(title: string) {
    await expect(this.getInsight(title)).toBeVisible()
  }

  /**
   * Assert insight type visible
   */
  async assertInsightTypeVisible(type: 'Vazamento' | 'Principal' | 'Oportunidade' | 'Anomalia') {
    const selector = {
      'Vazamento': this.leakageInsights,
      'Principal': this.mainExpenseInsights,
      'Oportunidade': this.opportunityInsights,
      'Anomalia': this.anomalyInsights,
    }
    await expect(selector[type].first()).toBeVisible()
  }
}
