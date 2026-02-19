const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Foams
  getFoams: () => request<any[]>('/foams'),
  getFoam: (id: number) => request<any>(`/foams/${id}`),
  createFoam: (data: any) => request<any>('/foams', { method: 'POST', body: JSON.stringify(data) }),
  updateFoam: (id: number, data: any) => request<any>(`/foams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFoam: (id: number) => request<any>(`/foams/${id}`, { method: 'DELETE' }),

  // Dacrons
  getDacrons: () => request<any[]>('/dacrons'),
  createDacron: (data: any) => request<any>('/dacrons', { method: 'POST', body: JSON.stringify(data) }),
  updateDacron: (id: number, data: any) => request<any>(`/dacrons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDacron: (id: number) => request<any>(`/dacrons/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: () => request<any[]>('/customers'),
  getCustomer: (id: number) => request<any>(`/customers/${id}`),
  createCustomer: (data: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: any) => request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: number) => request<any>(`/customers/${id}`, { method: 'DELETE' }),
  getCustomerFoamPricing: (id: number) => request<any[]>(`/customers/${id}/foam-pricing`),
  upsertCustomerFoamPricing: (id: number, data: any) =>
    request<any>(`/customers/${id}/foam-pricing`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomerFoamPricing: (customerId: number, foamId: number) =>
    request<any>(`/customers/${customerId}/foam-pricing/${foamId}`, { method: 'DELETE' }),
  getPartTemplate: (id: number) => request<any>(`/customers/${id}/part-template`),
  updatePartTemplate: (id: number, template: string) =>
    request<any>(`/customers/${id}/part-template`, { method: 'PUT', body: JSON.stringify({ template }) }),

  // Settings
  getLaborSettings: () => request<any>('/settings/labor'),
  updateLaborSettings: (data: any) => request<any>('/settings/labor', { method: 'PUT', body: JSON.stringify(data) }),
  getOverheadSettings: () => request<any>('/settings/overhead'),
  updateOverheadSettings: (data: any) => request<any>('/settings/overhead', { method: 'PUT', body: JSON.stringify(data) }),

  // Pricing
  calculatePrice: (data: any) => request<any>('/pricing/calculate', { method: 'POST', body: JSON.stringify(data) }),

  // Quotes
  getQuotes: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/quotes${qs}`);
  },
  createQuote: (data: any) => request<any>('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuote: (id: number, data: any) => request<any>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuote: (id: number) => request<any>(`/quotes/${id}`, { method: 'DELETE' }),

  // Inventory
  getFoamInventory: () => request<any[]>('/inventory/foam'),
  upsertFoamInventory: (data: any) => request<any>('/inventory/foam', { method: 'POST', body: JSON.stringify(data) }),
  getFoamLowStock: () => request<any[]>('/inventory/foam/low-stock'),
  getDacronInventory: () => request<any[]>('/inventory/dacron'),
  upsertDacronInventory: (data: any) => request<any>('/inventory/dacron', { method: 'POST', body: JSON.stringify(data) }),
  getDacronLowStock: () => request<any[]>('/inventory/dacron/low-stock'),

  // Rules
  getRules: () => request<any[]>('/rules'),
  createRule: (data: any) => request<any>('/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: number, data: any) => request<any>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRule: (id: number) => request<any>(`/rules/${id}`, { method: 'DELETE' }),

  // AI
  aiChat: (message: string, history: any[] = []) =>
    request<any>('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  aiConfirm: (actions: any[]) =>
    request<any>('/ai/confirm', { method: 'POST', body: JSON.stringify({ actions }) }),
  getAiHistory: () => request<any[]>('/ai/history'),
  clearAiHistory: () => request<any>('/ai/history', { method: 'DELETE' }),

  // Import
  previewFoamImport: (data: string, mapping?: any) =>
    request<any>('/import/foams/preview', { method: 'POST', body: JSON.stringify({ data, mapping }) }),
  executeFoamImport: (data: string, mapping?: any) =>
    request<any>('/import/foams', { method: 'POST', body: JSON.stringify({ data, mapping }) }),
};
