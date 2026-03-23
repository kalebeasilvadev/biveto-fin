import api from './api'

export const documentsApi = {
  upload: (file: File, password?: string, creditCardId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (password) formData.append('password', password)
    if (creditCardId) formData.append('credit_card_id', creditCardId.toString())
    return api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // Upload async: retorna imediatamente com status "processing"
  uploadAsync: (file: File, password?: string, creditCardId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (password) formData.append('password', password)
    if (creditCardId) formData.append('credit_card_id', creditCardId.toString())
    return api.post('/documents/async', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadBatch: (files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post('/documents/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: () => api.get('/documents'),
  get: (id: number) => api.get(`/documents/${id}`),
}

export const invoicesApi = {
  list: (params?: {
    credit_card_id?: number
    status?: string
    year?: number
    month?: number
    limit?: number
    offset?: number
  }) => api.get('/invoices', { params }),
  get: (id: number) => api.get(`/invoices/${id}`),
  create: (data: unknown) => api.post('/invoices', data),
  createFromDocument: (data: unknown) => api.post('/invoices/from-document', data),
  update: (id: number, data: unknown) => api.patch(`/invoices/${id}`, data),
  delete: (id: number, deleteTransactions: boolean = false) =>
    api.delete(`/invoices/${id}`, { params: { delete_transactions: deleteTransactions } }),
  pay: (id: number, data: { amount: number; payment_account_id: number; payment_date?: string }) =>
    api.post(`/invoices/${id}/pay`, data),
  listByCard: (cardId: number, year?: number) =>
    api.get(`/invoices/credit-card/${cardId}`, { params: year ? { year } : {} }),
  getCurrentByCard: (cardId: number) =>
    api.get(`/invoices/credit-card/${cardId}/current`),
  detectCard: (documentData: { card_issuer?: string; card_last_digits?: string }) =>
    api.post('/invoices/detect-card', documentData),
  createCardFromInvoice: (data: {
    card_issuer: string
    card_last_digits?: string
    card_name?: string
    closing_day?: number
    due_day?: number
    credit_limit?: number
    color?: string
    icon?: string
  }) => api.post('/invoices/create-card-from-invoice', data),
  projectFuture: (data: {
    credit_card_id: number
    months_ahead?: number
    include_installments?: boolean
    include_recurring?: boolean
  }) => api.post('/invoices/project-future', data),
  reprocessOrphanTransactions: (creditCardId?: number) =>
    api.post('/invoices/reprocess-orphan-transactions', null, {
      params: creditCardId ? { credit_card_id: creditCardId } : {},
    }),
}
