import api from './api'

export const analyticsApi = {
  summary: (year: number, month: number) =>
    api.get('/analytics/summary', { params: { year, month } }),
  insights: (startDate: string, endDate: string) =>
    api.get('/analytics/insights', {
      params: { start_date: startDate, end_date: endDate },
    }),
}

export const reviewApi = {
  // Weekly review
  getWeeklyReview: (year: number, week: number) =>
    api.get(`/review/weekly/${year}/${week}`),
  getCurrentWeekReview: () =>
    api.get('/review/weekly/current'),
  completeReview: (year: number, week: number, notes?: string) =>
    api.post(`/review/weekly/${year}/${week}/complete`, { year, week, notes }),
}

export const calendarApi = {
  // Daily calendar with projections
  getDaily: (params?: {
    start_date?: string
    end_date?: string
    include_details?: boolean
  }) => api.get('/calendar/daily', { params }),

  // Weekly summary
  getWeekly: (year: number, week: number, comparePrevious: boolean = true) =>
    api.get(`/calendar/weekly/${year}/${week}`, {
      params: { compare_previous: comparePrevious },
    }),

  // Monthly calendar
  getMonthly: (year: number, month: number, includeDetails: boolean = false) =>
    api.get(`/calendar/monthly/${year}/${month}`, {
      params: { include_details: includeDetails },
    }),

  // Running balance projection
  getRunningBalance: (params?: {
    start_date?: string
    end_date?: string
    days?: number
  }) => api.get('/calendar/running-balance', { params }),

  // Future projections
  getProjections: (daysAhead: number, includeDetails: boolean = true) =>
    api.get(`/calendar/projections/${daysAhead}`, {
      params: { include_details: includeDetails },
    }),
}

// Simulator API extensions (using existing debt/goal endpoints)
export const simulatorsApi = {
  // Debt simulators
  getSnowballPlan: (monthlyPayment: number) =>
    api.get('/debts/snowball', { params: { monthly_payment: monthlyPayment } }),
  getAvalanchePlan: (monthlyPayment: number) =>
    api.get('/debts/avalanche', { params: { monthly_payment: monthlyPayment } }),
  compareStrategies: (monthlyPayment: number) =>
    api.get('/debts/compare-strategies', { params: { monthly_payment: monthlyPayment } }),

  // Goal simulators
  calculateEmergencyFund: (months: number = 6) =>
    api.get('/goals/emergency-fund', { params: { months } }),
  calculatePNIF: (expectedReturn: number = 0.08) =>
    api.get('/goals/pnif', { params: { expected_return: expectedReturn } }),

  // Cash flow projection (using calendar)
  projectCashFlow: (daysAhead: number = 90) =>
    api.get(`/calendar/projections/${daysAhead}`),
}
