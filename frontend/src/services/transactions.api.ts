import api from './api'

export const transactionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/transactions', { params }),
  create: (data: unknown) => api.post('/transactions', data),
  confirm: (data: unknown) => api.post('/transactions/confirm', data),
  batchConfirm: (data: {
    items: unknown[]
    card_closing_day?: number
    card_due_day?: number
  }) => api.post('/transactions/batch-confirm', data),
  update: (id: number, data: unknown) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
  checkProjected: (data: {
    items: Array<{
      index: number
      description: string
      amount: number
      date?: string
      is_installment?: boolean
      installment_current?: number
      installment_total?: number
    }>
    credit_card_id?: number
    invoice_month?: number
    invoice_year?: number
  }) => api.post('/transactions/check-projected', data),
  exportCSV: async (params?: Record<string, unknown>) => {
    const response = await api.get('/transactions/export/csv', {
      params,
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    link.setAttribute('download', `transacoes_${date}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

export const installmentsApi = {
  list: (params?: { status_filter?: string; limit?: number }) =>
    api.get('/installments', { params }),
  getById: (id: number) => api.get(`/installments/${id}`),
  detectDuplicates: (minSimilarity = 0.7) =>
    api.post('/installments/detect-duplicates', { min_similarity: minSimilarity }),
  merge: (data: {
    source_series_id: number
    target_series_id: number
    conflict_resolution?: string
    new_merchant_name?: string
  }) => api.post('/installments/merge', data),
  update: (id: number, data: {
    description?: string
    merchant_name?: string
    not_duplicate_with?: number[]
  }) => api.patch(`/installments/${id}`, data),
  getDuplicateWarnings: (invoiceId: number) =>
    api.get(`/invoices/${invoiceId}/duplicate-warnings`),
}

export const categoriesApi = {
  list: () => api.get('/categories'),
}
