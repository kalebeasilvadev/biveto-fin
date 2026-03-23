import api from './api'

export const accountsApi = {
  list: () => api.get('/accounts'),
  get: (id: number) => api.get(`/accounts/${id}`),
  create: (data: unknown) => api.post('/accounts', data),
  update: (id: number, data: unknown) => api.patch(`/accounts/${id}`, data),
  delete: (id: number) => api.delete(`/accounts/${id}`),
}

export const creditCardsApi = {
  list: () => api.get('/credit-cards'),
  get: (id: number) => api.get(`/credit-cards/${id}`),
  create: (data: unknown) => api.post('/credit-cards', data),
  update: (id: number, data: unknown) => api.patch(`/credit-cards/${id}`, data),
  delete: (id: number) => api.delete(`/credit-cards/${id}`),
  recalculateInvoices: (id: number) => api.post(`/credit-cards/${id}/recalculate-invoices`),
  projectRecurring: (id: number, monthsAhead?: number) =>
    api.post(`/credit-cards/${id}/project-recurring`, null, {
      params: monthsAhead ? { months_ahead: monthsAhead } : {}
    }),
  // Invoice PDF password management
  saveInvoicePassword: (id: number, password: string) =>
    api.post(`/credit-cards/${id}/invoice-password`, { password }),
  deleteInvoicePassword: (id: number) =>
    api.delete(`/credit-cards/${id}/invoice-password`),
}

export const benefitCardsApi = {
  list: () => api.get('/benefit-cards'),
  get: (id: number) => api.get(`/benefit-cards/${id}`),
  create: (data: unknown) => api.post('/benefit-cards', data),
  update: (id: number, data: unknown) => api.patch(`/benefit-cards/${id}`, data),
  delete: (id: number) => api.delete(`/benefit-cards/${id}`),
  adjustBalance: (id: number, data: { adjustment_amount: number; reason: string }) =>
    api.post(`/benefit-cards/${id}/adjust-balance`, data),
}
