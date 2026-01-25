import type { HelpContent } from './types'
import { dashboardHelp } from './dashboard'
import { transactionsHelp } from './transactions'
import { accountsHelp } from './accounts'
import { creditCardsHelp } from './credit-cards'
import { invoicesHelp } from './invoices'
import { budgetHelp } from './budget'
import { goalsHelp } from './goals'
import { debtsHelp } from './debts'
import { recurringHelp } from './recurring'
import { incomeSourcesHelp } from './income-sources'
import { incomeSplitRulesHelp } from './income-split-rules'
// Envelopes module removed - functionality merged into Budgets module
// import { envelopesHelp } from './envelopes'
import { calendarHelp } from './calendar'
import { simulatorsHelp } from './simulators'
import { automationsHelp } from './automations'
import { weeklyReviewHelp } from './weekly-review'
import { insightsHelp } from './insights'
import { uploadHelp } from './upload'
import { chatHelp } from './chat'
import { familyHelp } from './family'
import { settingsHelp } from './settings'
import { apiKeysHelp } from './api-keys'
import { onboardingHelp } from './onboarding'
import { marketHelp } from './market'

export type { HelpContent, HelpSection } from './types'

const helpContentRegistry: Record<string, HelpContent> = {
  dashboard: dashboardHelp,
  transactions: transactionsHelp,
  accounts: accountsHelp,
  'credit-cards': creditCardsHelp,
  invoices: invoicesHelp,
  budget: budgetHelp,
  goals: goalsHelp,
  debts: debtsHelp,
  recurring: recurringHelp,
  'income-sources': incomeSourcesHelp,
  'income-split-rules': incomeSplitRulesHelp,
  // envelopes removed - functionality merged into budget
  calendar: calendarHelp,
  simulators: simulatorsHelp,
  automations: automationsHelp,
  'weekly-review': weeklyReviewHelp,
  insights: insightsHelp,
  upload: uploadHelp,
  chat: chatHelp,
  family: familyHelp,
  settings: settingsHelp,
  'api-keys': apiKeysHelp,
  onboarding: onboardingHelp,
  market: marketHelp,
}

export function getHelpContent(pageId: string): HelpContent | undefined {
  return helpContentRegistry[pageId]
}

export function getAllHelpContent(): HelpContent[] {
  return Object.values(helpContentRegistry)
}
