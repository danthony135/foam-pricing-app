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
  // Odoo
  getOdooStatus: () => request<any>('/odoo/status'),
  updateOdooSettings: (data: any) => request<any>('/odoo/settings', { method: 'PUT', body: JSON.stringify(data) }),
  syncOdoo: () => request<any>('/odoo/sync/all', { method: 'POST' }),
  getOpenMos: (states?: string) => request<any[]>(`/odoo/mos${states ? `?states=${states}` : ''}`),
  getSchedules: () => request<any[]>('/odoo/schedules'),
  buildScheduleOrder: (scheduleNumber: string) => request<any>('/foam-orders/from-schedule', { method: 'POST', body: JSON.stringify({ scheduleNumber }) }),
  saveCutProgress: (id: number, done: string[]) => request<any>(`/foam-orders/${id}/progress`, { method: 'PUT', body: JSON.stringify({ done }) }),

  // SKUs + foam pieces
  getSkus: (all = false) => request<any[]>(`/skus${all ? '?all=1' : ''}`),
  getSku: (id: number) => request<any>(`/skus/${id}`),
  updateSku: (id: number, data: any) => request<any>(`/skus/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addPiece: (skuId: number, data: any) => request<any>(`/skus/${skuId}/pieces`, { method: 'POST', body: JSON.stringify(data) }),
  updatePiece: (skuId: number, pieceId: number, data: any) => request<any>(`/skus/${skuId}/pieces/${pieceId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePiece: (skuId: number, pieceId: number) => request<any>(`/skus/${skuId}/pieces/${pieceId}`, { method: 'DELETE' }),
  copyPieces: (skuId: number, sourceId: number, replace: boolean) => request<any>(`/skus/${skuId}/copy-from/${sourceId}`, { method: 'POST', body: JSON.stringify({ replace }) }),
  importPieces: (rows: any[]) => request<any>('/skus/import-pieces', { method: 'POST', body: JSON.stringify({ rows }) }),
  pushSkuBom: (id: number) => request<any>(`/skus/${id}/push`, { method: 'POST' }),

  // Foam orders (cut lists + nests)
  getFoamOrders: () => request<any[]>('/foam-orders'),
  getFoamOrder: (id: number) => request<any>(`/foam-orders/${id}`),
  createFoamOrder: (data: any) => request<any>('/foam-orders', { method: 'POST', body: JSON.stringify(data) }),
  optimizeFoamOrder: (id: number) => request<any>(`/foam-orders/${id}/optimize`, { method: 'POST' }),
  updateFoamOrder: (id: number, data: any) => request<any>(`/foam-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFoamOrder: (id: number) => request<any>(`/foam-orders/${id}`, { method: 'DELETE' }),
  createFoamRfq: (id: number, full = false) => request<any>(`/foam-orders/${id}/rfq`, { method: 'POST', body: JSON.stringify({ full }) }),

  // Foams (slab stock)
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

  // Inventory
  getFoamInventory: () => request<any[]>('/inventory/foam'),
  upsertFoamInventory: (data: any) => request<any>('/inventory/foam', { method: 'POST', body: JSON.stringify(data) }),
  getFoamLowStock: () => request<any[]>('/inventory/foam/low-stock'),
  getDacronInventory: () => request<any[]>('/inventory/dacron'),
  upsertDacronInventory: (data: any) => request<any>('/inventory/dacron', { method: 'POST', body: JSON.stringify(data) }),
  getDacronLowStock: () => request<any[]>('/inventory/dacron/low-stock'),
};
