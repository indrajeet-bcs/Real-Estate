import api from './client.js'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/profile', payload),
  uploadDocument: (formData) => api.post('/auth/profile/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  logoutAll: () => api.post('/auth/logout-all'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  setPassword: (payload) => api.post('/auth/set-password', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  verifyInvitation: (token) => api.get(`/auth/verify-invitation?token=${encodeURIComponent(token)}`),
  acceptInvitation: (payload) => api.post('/auth/accept-invitation', payload),
}
