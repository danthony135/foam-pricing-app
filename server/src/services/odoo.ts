/**
 * Minimal Odoo 19 JSON-2 client (same service account + endpoint shape as
 * FurnitureSuite and the leather-cutter). Configured by ODOO_URL, ODOO_DB,
 * ODOO_API_KEY. Every call fails loudly when not configured.
 */
type Domain = unknown[];

export function odooConfigured(): boolean {
  return !!(process.env.ODOO_URL && process.env.ODOO_API_KEY);
}

async function rpc<T = unknown>(model: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = (process.env.ODOO_URL || '').replace(/\/+$/, '');
  const key = process.env.ODOO_API_KEY;
  if (!url || !key) throw new Error('Odoo is not configured (ODOO_URL / ODOO_API_KEY)');
  const res = await fetch(`${url}/json/2/${model}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as any;
  if (!res.ok || (data && typeof data === 'object' && data.name && data.message && data.debug)) {
    throw new Error(`Odoo ${model}.${method}: ${data?.message || res.status}`);
  }
  return data as T;
}

export const odoo = {
  searchRead<T = any>(model: string, domain: Domain, fields: string[], opts: { limit?: number; order?: string; context?: Record<string, unknown>; offset?: number } = {}) {
    return rpc<T[]>(model, 'search_read', { domain, fields, limit: opts.limit ?? 5000, order: opts.order, offset: opts.offset, context: opts.context });
  },
  searchCount(model: string, domain: Domain, context?: Record<string, unknown>) {
    return rpc<number>(model, 'search_count', { domain, context });
  },
  read<T = any>(model: string, ids: number[], fields: string[]) {
    return rpc<T[]>(model, 'read', { ids, fields });
  },
  create(model: string, vals: Record<string, unknown>) {
    return rpc<number>(model, 'create', { vals_list: [vals] }).then((r) => (Array.isArray(r) ? r[0] : r));
  },
  write(model: string, ids: number[], vals: Record<string, unknown>) {
    return rpc<boolean>(model, 'write', { ids, vals });
  },
  unlink(model: string, ids: number[]) {
    return rpc<boolean>(model, 'unlink', { ids });
  },
  call<T = unknown>(model: string, method: string, ids: number[], kwargs: Record<string, unknown> = {}) {
    return rpc<T>(model, method, { ids, ...kwargs });
  },
};
