import api from './api'

export const adminApi = {
  // Dashboard
  dashboard: () => api.get('/admin/dashboard'),

  // Users
  listUsers: () => api.get('/admin/users'),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  createUser: (data: unknown) => api.post('/admin/users', data),
  updateUser: (id: number, data: unknown) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),

  // Licenses
  listLicenses: () => api.get('/admin/licenses'),
  createLicense: (data: unknown) => api.post('/admin/licenses', data),
  updateLicense: (id: number, data: unknown) => api.patch(`/admin/licenses/${id}`, data),
  deleteLicense: (id: number) => api.delete(`/admin/licenses/${id}`),
  resendLicenseInvitation: (licenseId: number) => api.post(`/admin/licenses/${licenseId}/resend-invitation`),

  // Invitations
  listInvitations: () => api.get('/admin/invitations'),
  resendInvitation: (id: number) => api.post(`/admin/invitations/${id}/resend`),
  cancelInvitation: (id: number) => api.delete(`/admin/invitations/${id}`),
}

export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (data: { name: string; notes?: string; expires_in_days?: number }) =>
    api.post('/api-keys', data),
  get: (id: number) => api.get(`/api-keys/${id}`),
  revoke: (id: number) => api.post(`/api-keys/${id}/revoke`),
  delete: (id: number) => api.delete(`/api-keys/${id}`),
}

export const familyApi = {
  // Contexto da familia
  getContext: () => api.get('/family/context'),

  // Membros
  listMembers: () => api.get('/family/members'),
  removeMember: (memberId: number) => api.delete(`/family/members/${memberId}`),

  // Convites
  invite: (email: string, nickname?: string) =>
    api.post('/family/invite', { email, nickname }),
  listInvitations: () => api.get('/family/invitations'),
  cancelInvitation: (id: number) => api.delete(`/family/invitations/${id}`),
  resendInvitation: (id: number) => api.post(`/family/invitations/${id}/resend`),
}

export const notificationsApi = {
  // Notifications
  list: (params?: { limit?: number; offset?: number; unread_only?: boolean; type?: string }) =>
    api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  getSummary: () => api.get('/notifications/summary'),
  get: (id: number) => api.get(`/notifications/${id}`),
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
  dismiss: (id: number) => api.delete(`/notifications/${id}`),

  // Preferences
  listPreferences: () => api.get('/notifications/preferences'),
  getPreference: (type: string) => api.get(`/notifications/preferences/${type}`),
  updatePreference: (type: string, data: unknown) =>
    api.put(`/notifications/preferences/${type}`, data),

  // Settings
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: unknown) => api.put('/notifications/settings', data),

  // Push
  subscribePush: (data: {
    endpoint: string
    p256dh_key: string
    auth_key: string
    user_agent?: string
    device_name?: string
  }) => api.post('/notifications/push/subscribe', data),
  unsubscribePush: (endpoint: string) =>
    api.post('/notifications/push/unsubscribe', null, { params: { endpoint } }),
  listPushSubscriptions: () => api.get('/notifications/push/subscriptions'),
}

export const automationsApi = {
  // Automation rules CRUD
  list: (params?: {
    include_inactive?: boolean
    trigger_type?: string
    action_type?: string
  }) => api.get('/automations', { params }),
  get: (id: number) => api.get(`/automations/${id}`),
  create: (data: {
    name: string
    description?: string
    trigger_type: string
    trigger_config: Record<string, unknown>
    conditions?: Record<string, unknown>
    action_type: string
    action_config: Record<string, unknown>
    is_active?: boolean
    priority?: number
  }) => api.post('/automations', data),
  update: (id: number, data: unknown) => api.patch(`/automations/${id}`, data),
  delete: (id: number) => api.delete(`/automations/${id}`),

  // Actions
  toggle: (id: number) => api.post(`/automations/${id}/toggle`),
  test: (id: number) => api.post(`/automations/${id}/test`),
  execute: (id: number) => api.post(`/automations/${id}/execute`),

  // Execution history
  listExecutions: (params?: {
    rule_id?: number
    status?: string
    limit?: number
  }) => api.get('/automations/executions', { params }),
  getRuleExecutions: (ruleId: number, limit: number = 20) =>
    api.get(`/automations/${ruleId}/executions`, { params: { limit } }),
}
