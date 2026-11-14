// services/adminApi.js — Admin API service layer
import { api } from '../api';

export const adminApi = {
  getDashboard: () => api('/admin/dashboard'),

  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/admin/users?${qs}`);
  },

  suspendUser: (id, reason) =>
    api(`/admin/users/${id}/suspend`, { method: 'PATCH', body: { reason } }),

  reactivateUser: (id, reason) =>
    api(`/admin/users/${id}/reactivate`, { method: 'PATCH', body: { reason } }),

  getListings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/admin/listings?${qs}`);
  },

  removeListing: (id, reason) =>
    api(`/admin/listings/${id}`, { method: 'DELETE', body: { reason } }),

  getReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/admin/reports?${qs}`);
  },

  updateReport: (id, data) =>
    api(`/admin/reports/${id}`, { method: 'PATCH', body: data }),

  getCategories: () => api('/admin/categories'),

  createCategory: (data) =>
    api('/admin/categories', { method: 'POST', body: data }),

  updateCategory: (id, data) =>
    api(`/admin/categories/${id}`, { method: 'PUT', body: data }),

  toggleCategory: (id) =>
    api(`/admin/categories/${id}/toggle`, { method: 'PATCH' }),

  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/admin/audit-logs?${qs}`);
  },
};

export const reportApi = {
  createReport: (data) =>
    api('/reports', { method: 'POST', body: data }),
};

export const blockApi = {
  block: (userId) => api(`/users/${userId}/block`, { method: 'POST' }),
  unblock: (userId) => api(`/users/${userId}/block`, { method: 'DELETE' }),
  getBlocked: () => api('/users/me/blocked'),
};
