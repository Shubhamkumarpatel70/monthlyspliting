const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText || 'Request failed');
  return data;
}

export const auth = {
  signup: (name, email, password, mobile) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password, mobile }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  loginMobile: (mobile, password) => request('/auth/login-mobile', { method: 'POST', body: JSON.stringify({ mobile, password }) }),
  checkMobile: (mobile) => request(`/auth/check-mobile/${encodeURIComponent(mobile)}`),
  me: () => request('/auth/me'),
};

export const groups = {
  list: () => request('/groups'),
  get: (id) => request(`/groups/${id}`),
  joinInfo: (id) => request(`/groups/${id}/join-info`),
  join: (id) => request(`/groups/${id}/join`, { method: 'POST' }),
  create: (name) => request('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  addMember: (id, mobile, email) => request(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify(mobile != null ? { mobile } : { email }) }),
  removeMember: (groupId, userId) => request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
};

export const expenses = {
  list: (groupId, month) => request(`/groups/${groupId}/expenses${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  months: (groupId) => request(`/groups/${groupId}/months`),
  create: (groupId, data) => request(`/groups/${groupId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (groupId, expenseId, data) => request(`/groups/${groupId}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (groupId, expenseId) => request(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' }),
  balances: (groupId, month) => request(`/groups/${groupId}/balances?month=${encodeURIComponent(month)}`),
  settlement: (groupId, month) => request(`/groups/${groupId}/settlement?month=${encodeURIComponent(month)}`),
  settlementStatus: (groupId, month, status) => request(`/groups/${groupId}/settlement/status`, { method: 'PUT', body: JSON.stringify({ month, status }) }),
};
