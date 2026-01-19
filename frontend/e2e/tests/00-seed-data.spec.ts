import { test, expect } from '@playwright/test'
import {
  AccountsPage,
  CreditCardsPage,
  TransactionsPage,
  RecurringPage,
  IncomeSourcesPage,
  GoalsPage,
  DebtsPage,
  BudgetPage,
  UploadPage,
} from '../pages'
import {
  TEST_ACCOUNT,
  TEST_CREDIT_CARD,
  TEST_TRANSACTION,
  TEST_RECURRING,
  TEST_INCOME_SOURCE,
  TEST_GOAL,
  TEST_DEBT,
  TEST_BUDGET_ITEM,
} from '../fixtures/test-data'
import { waitForPageStable, getCurrentDate } from '../utils/test.helper'

/**
 * Seed Data Tests
 * Creates test data for all entities. Run this first to populate the app with test data.
 *
 * Usage: npm run test:e2e -- tests/00-seed-data.spec.ts
 */

test.describe.serial('Seed Data - Criar dados de teste', () => {
  test('01 - Criar conta de teste', async ({ page }) => {
    const accountsPage = new AccountsPage(page)
    await accountsPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await accountsPage.accountExists(TEST_ACCOUNT.name)
    if (exists) {
      console.log(`Conta "${TEST_ACCOUNT.name}" já existe`)
      return
    }

    await accountsPage.createAccount({
      name: TEST_ACCOUNT.name,
      type: TEST_ACCOUNT.typeLabel,
      balance: TEST_ACCOUNT.balance,
    })

    await waitForPageStable(page)
    await accountsPage.assertAccountExists(TEST_ACCOUNT.name)
    console.log(`✓ Conta "${TEST_ACCOUNT.name}" criada`)
  })

  test('02 - Criar cartão de crédito de teste', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)
    await creditCardsPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await creditCardsPage.cardExists(TEST_CREDIT_CARD.name)
    if (exists) {
      console.log(`Cartão "${TEST_CREDIT_CARD.name}" já existe`)
      return
    }

    await creditCardsPage.createCard({
      name: TEST_CREDIT_CARD.name,
      limit: TEST_CREDIT_CARD.limit,
      closingDay: TEST_CREDIT_CARD.closingDay,
      dueDay: TEST_CREDIT_CARD.dueDay,
    })

    await waitForPageStable(page)
    await creditCardsPage.assertCardExists(TEST_CREDIT_CARD.name)
    console.log(`✓ Cartão "${TEST_CREDIT_CARD.name}" criado`)
  })

  test('03 - Criar transação de teste (despesa)', async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto()
    await waitForPageStable(page)

    // createManualTransaction handles mode selection internally
    await uploadPage.createManualTransaction({
      type: 'Despesa',
      amount: TEST_TRANSACTION.amount,
      date: getCurrentDate(),
      description: TEST_TRANSACTION.description,
      category: TEST_TRANSACTION.category,
    })

    await waitForPageStable(page)
    console.log(`✓ Transação "${TEST_TRANSACTION.description}" criada`)
  })

  test('04 - Criar transação de teste (receita)', async ({ page }) => {
    const uploadPage = new UploadPage(page)
    await uploadPage.goto()
    await waitForPageStable(page)

    // Use a valid income category
    await uploadPage.createManualTransaction({
      type: 'Receita',
      amount: '2500',
      date: getCurrentDate(),
      description: 'Receita Teste E2E',
    })

    await waitForPageStable(page)
    console.log(`✓ Transação de receita criada`)
  })

  test('05 - Criar transação recorrente de teste', async ({ page }) => {
    const recurringPage = new RecurringPage(page)
    await recurringPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await recurringPage.recurringExists(TEST_RECURRING.name)
    if (exists) {
      console.log(`Recorrente "${TEST_RECURRING.name}" já existe`)
      return
    }

    await recurringPage.createRecurring({
      name: TEST_RECURRING.name,
      amount: TEST_RECURRING.amount,
      type: 'Despesa',
      frequency: 'Mensal',
      day: TEST_RECURRING.day,
    })

    await waitForPageStable(page)
    console.log(`✓ Recorrente "${TEST_RECURRING.name}" criada`)
  })

  test('06 - Criar fonte de receita de teste', async ({ page }) => {
    const incomeSourcesPage = new IncomeSourcesPage(page)
    await incomeSourcesPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await incomeSourcesPage.sourceExists(TEST_INCOME_SOURCE.name)
    if (exists) {
      console.log(`Fonte de receita "${TEST_INCOME_SOURCE.name}" já existe`)
      return
    }

    await incomeSourcesPage.createSource({
      name: TEST_INCOME_SOURCE.name,
      type: TEST_INCOME_SOURCE.typeLabel as 'Salário' | 'Freelance' | 'Investimentos' | 'Outros',
      amount: TEST_INCOME_SOURCE.expectedAmount,
      frequency: 'Mensal',
      day: TEST_INCOME_SOURCE.day,
    })

    await waitForPageStable(page)
    console.log(`✓ Fonte de receita "${TEST_INCOME_SOURCE.name}" criada`)
  })

  test('07 - Criar meta de teste', async ({ page }) => {
    const goalsPage = new GoalsPage(page)
    await goalsPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await goalsPage.goalExists(TEST_GOAL.name)
    if (exists) {
      console.log(`Meta "${TEST_GOAL.name}" já existe`)
      return
    }

    await goalsPage.createGoal({
      name: TEST_GOAL.name,
      target: TEST_GOAL.target,
    })

    await waitForPageStable(page)
    console.log(`✓ Meta "${TEST_GOAL.name}" criada`)
  })

  test('08 - Criar dívida de teste', async ({ page }) => {
    const debtsPage = new DebtsPage(page)
    await debtsPage.goto()
    await waitForPageStable(page)

    // Check if already exists
    const exists = await debtsPage.debtExists(TEST_DEBT.name)
    if (exists) {
      console.log(`Dívida "${TEST_DEBT.name}" já existe`)
      return
    }

    await debtsPage.createDebt({
      name: TEST_DEBT.name,
      originalValue: TEST_DEBT.originalValue,
      currentBalance: TEST_DEBT.currentBalance,
      interestRate: TEST_DEBT.interestRate,
      creditor: TEST_DEBT.creditor,
    })

    await waitForPageStable(page)
    console.log(`✓ Dívida "${TEST_DEBT.name}" criada`)
  })

  test('09 - Criar item de orçamento de teste', async ({ page }) => {
    const budgetPage = new BudgetPage(page)
    await budgetPage.goto()
    await waitForPageStable(page)

    // Try to add budget item
    await budgetPage.addBudgetItem({
      category: TEST_BUDGET_ITEM.category,
      planned: TEST_BUDGET_ITEM.planned,
    })

    await waitForPageStable(page)
    console.log(`✓ Item de orçamento "${TEST_BUDGET_ITEM.category}" criado`)
  })

  test('10 - Criar mais transações variadas', async ({ page }) => {
    const uploadPage = new UploadPage(page)

    // Use valid category names that match the API
    const transactions = [
      { type: 'Despesa' as const, amount: '89.90', description: 'Supermercado E2E', category: 'Supermercado' },
      { type: 'Despesa' as const, amount: '150.00', description: 'Combustível E2E', category: 'Transporte' },
      { type: 'Despesa' as const, amount: '45.00', description: 'Streaming E2E', category: 'Lazer' },
      { type: 'Despesa' as const, amount: '200.00', description: 'Farmácia E2E', category: 'Saúde' },
      { type: 'Receita' as const, amount: '500.00', description: 'Freelance E2E', category: 'Outros' },
    ]

    for (const tx of transactions) {
      await uploadPage.goto()
      await waitForPageStable(page)

      await uploadPage.createManualTransaction({
        type: tx.type,
        amount: tx.amount,
        date: getCurrentDate(),
        description: tx.description,
        category: tx.category,
      })

      await waitForPageStable(page)
      console.log(`✓ Transação "${tx.description}" criada`)
    }
  })
})

test.describe.serial('Seed Data - Verificar dados criados', () => {
  test('11 - Verificar conta existe', async ({ page }) => {
    const accountsPage = new AccountsPage(page)
    await accountsPage.goto()
    await waitForPageStable(page)

    const exists = await accountsPage.accountExists(TEST_ACCOUNT.name)
    console.log(`Conta "${TEST_ACCOUNT.name}" existe: ${exists}`)
  })

  test('12 - Verificar cartão existe', async ({ page }) => {
    const creditCardsPage = new CreditCardsPage(page)
    await creditCardsPage.goto()
    await waitForPageStable(page)

    const exists = await creditCardsPage.cardExists(TEST_CREDIT_CARD.name)
    console.log(`Cartão "${TEST_CREDIT_CARD.name}" existe: ${exists}`)
  })

  test('13 - Verificar transações existem', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)
    await transactionsPage.goto()
    await waitForPageStable(page)

    const count = await transactionsPage.getTransactionCount()
    console.log(`Total de transações: ${count}`)
  })

  test('14 - Verificar meta existe', async ({ page }) => {
    const goalsPage = new GoalsPage(page)
    await goalsPage.goto()
    await waitForPageStable(page)

    const exists = await goalsPage.goalExists(TEST_GOAL.name)
    console.log(`Meta "${TEST_GOAL.name}" existe: ${exists}`)
  })
})
