const API_BASE = '/api';

export const tokenStorage = {
  getToken: () => localStorage.getItem('finguard_token'),
  setToken: (token) => localStorage.setItem('finguard_token', token),
  removeToken: () => localStorage.removeItem('finguard_token'),
  getUser: () => {
    try {
      const u = localStorage.getItem('finguard_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('finguard_user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('finguard_user'),
  clear: () => {
    localStorage.removeItem('finguard_token');
    localStorage.removeItem('finguard_user');
  }
};

async function request(endpoint, options = {}) {
  const token = tokenStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorMessage = data?.message || data?.error || (typeof data === 'string' ? data : 'Request failed');
    throw new Error(errorMessage);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getProfile: () => request('/auth/me'),

  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return request(`/transactions?${query.toString()}`);
  },
  createTransaction: (payload) => request('/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  updateTransaction: (id, payload) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getSummary: (month) => request(`/transactions/summary${month ? `?month=${month}` : ''}`),
  seedDemoData: () => request('/transactions/seed-demo', { method: 'POST' }),

  // Budgets & Alerts
  getBudgets: (monthYear) => request(`/budgets${monthYear ? `?month_year=${monthYear}` : ''}`),
  setBudget: (payload) => request('/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
  getAlerts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/alerts${query ? `?${query}` : ''}`);
  },
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),

  // Fraud Info
  getFraudModelInfo: () => request('/fraud/model-info'),

  // Gateway / System Health
  getHealth: () => request('/health'),
};
