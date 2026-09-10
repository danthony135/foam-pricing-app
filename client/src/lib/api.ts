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
  parseDxf: (base64: string) => request<any>('/skus/parse-dxf', { method: 'POST', body: JSON.stringify({ data: base64 }) }),

  // Foam orders (cut lists + nests)
  getFoamOrders: () => request<any[]>('/foam-orders'),
  getFoamOrder: (id: number) => request<any>(`/foam-orders/${id}`),
  createFoamOrder: (data: any) => request<any>('/foam-orders', { method: 'POST', body: JSON.stringify(data) }),
  optimizeFoamOrder: (id: number) => request<any>(`/foam-orders/${id}/optimize`, { method: 'POST' }),
  updateFoamOrder: (id: number, data: any) => request<any>(`/foam-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFoamOrder: (id: number) => request<any>(`/foam-orders/${id}`, { method: 'DELETE' }),
  createFoamRfq: (id: number, full = false) => request<any>(`/foam-orders/${id}/rfq`, { method: 'POST', body: JSON.stringify({ full }) }),

  // Scrap
  getScrap: (days = 90) => request<any>(`/scrap?days=${days}`),

  // Station: projector + overhead camera
  getStation: () => request<any>('/station/state'),
  setStationState: (data: any) => request<any>('/station/state', { method: 'PUT', body: JSON.stringify(data) }),
  getCalibration: () => request<any>('/station/calibration'),
  saveCalibration: (cal: any) => request<any>('/station/calibration', { method: 'PUT', body: JSON.stringify(cal) }),
  saveStationPrefs: (p: any) => request<any>('/station/prefs', { method: 'PUT', body: JSON.stringify(p) }),
  requestSnapshot: () => request<any>('/station/camera/request', { method: 'POST' }),
  pollSnapshotRequest: () => request<any>('/station/camera/request'),
  uploadSnapshot: (data: { id: number; jpeg: string; w: number; h: number }) => request<any>('/station/camera/snapshot', { method: 'POST', body: JSON.stringify(data) }),
  getSnapshot: (after = 0) => request<any>(`/station/camera/snapshot?after=${after}`),
  pingCameraAgent: () => request<any>('/station/camera/ping', { method: 'POST' }),
  cameraAgentStatus: () => request<any>('/station/camera/agent'),
  resizeSlab: (orderId: number, data: { foamId: number; slabIndex: number; lengthIn: number; widthIn: number; poly?: [number, number][] | null; x?: number; y?: number }) => request<any>(`/foam-orders/${orderId}/slabs/resize`, { method: 'POST', body: JSON.stringify(data) }),

  // Remnants (leftover foam on the rack)
  getRemnants: (opts: { foamId?: number; status?: string } = {}) => request<any[]>(`/remnants?${new URLSearchParams(Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])))}`),
  getRemnant: (id: number) => request<any>(`/remnants/${id}`),
  createRemnant: (data: { foamId: number; lengthIn?: number; widthIn?: number; shape?: [number, number][] | null; notes?: string }) => request<any>('/remnants', { method: 'POST', body: JSON.stringify(data) }),
  updateRemnant: (id: number, data: any) => request<any>(`/remnants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRemnant: (id: number) => request<any>(`/remnants/${id}`, { method: 'DELETE' }),
  matchRemnant: (remnantId: number) => request<any>('/remnants/match', { method: 'POST', body: JSON.stringify({ remnantId }) }),
  previewRemnant: (id: number, picks: any[], extra: any[]) => request<any>(`/remnants/${id}/preview`, { method: 'POST', body: JSON.stringify({ picks, extra }) }),
  claimRemnant: (id: number, picks: any[], extra: any[]) => request<any>(`/remnants/${id}/claim`, { method: 'POST', body: JSON.stringify({ picks, extra }) }),

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
