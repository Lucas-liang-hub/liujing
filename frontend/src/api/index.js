import { request, streamRequest } from './client.js';

export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  profile: () => request('/auth/profile'),
  updateProfile: (payload) => request('/auth/profile', { method: 'PUT', body: payload }),
};

export const sessionApi = {
  create: (payload) => request('/sessions', { method: 'POST', body: payload }),
  list: ({ page = 1, pageSize = 20 } = {}) => request(`/sessions?page=${page}&pageSize=${pageSize}`),
};

export const statsApi = {
  summary: () => request('/stats/summary'),
  heatmap: (days = 90) => request(`/stats/heatmap?days=${days}`),
};

export const aiApi = {
  config: () => request('/ai/config'),
  getLlm: () => request('/ai/llm'),
  setLlm: (payload) => request('/ai/llm', { method: 'PUT', body: payload }),
  clearLlm: () => request('/ai/llm', { method: 'DELETE' }),
  testLlm: (payload = {}) => request('/ai/llm/test', { method: 'POST', body: payload }),
  chat: ({ message, event = 'chat', history = [], scene }) =>
    request('/ai/chat', { method: 'POST', body: { message, event, history, scene } }),
  streamChat: ({ message, event = 'chat', history = [], scene }, onEvent, options) =>
    streamRequest('/ai/chat', { message, event, history, scene }, onEvent, options),
};
