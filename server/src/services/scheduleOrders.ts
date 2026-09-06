/**
 * Production lists = FurnitureSuite schedules = Odoo MOs sharing an
 * x_schedule_number (state confirmed/progress, not delayed). The operator picks
 * one list; this builds (or refreshes) the foam order for it, keeping any slab
 * progress already ticked off.
 */
import { prisma } from '../index';
import { odoo } from './odoo';
import { buildCutPlan, buildRequirements, type OrderLine } from './foamRequirements';
import { logScrapForOrder } from './scrap';

const OPEN_STATES = ['confirmed', 'progress'];

interface MoRow {
  id: number;
  name: string;
  product_id: [number, string];
  product_tmpl_id: [number, string];
  product_qty: number;
  x_schedule_number?: string | false;
  date_start?: string | false;
  origin?: string | false;
}

async function readScheduledMos(): Promise<MoRow[]> {
  const fields = ['id', 'name', 'product_id', 'product_tmpl_id', 'product_qty', 'x_schedule_number', 'date_start', 'origin'];
  const base: unknown[] = [['state', 'in', OPEN_STATES], ['x_schedule_number', '!=', false], ['x_schedule_number', '!=', ''], ['product_id.name', 'not ilike', '[ACPPARTS]']];
  try {
    return await odoo.searchRead<MoRow>('mrp.production', [...base, ['x_delayed', '!=', true]], fields, { limit: 10000, order: 'id' });
  } catch {
    // x_delayed is a Studio field — tolerate its absence.
    return odoo.searchRead<MoRow>('mrp.production', base, fields, { limit: 10000, order: 'id' });
  }
}

const natSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export interface ScheduleSummary {
  scheduleNumber: string;
  moCount: number;
  pieces: number; // sum of MO qty
  mapped: number; // MOs whose product is a synced SKU
  withPattern: number;
  orderId: number | null;
  status: string | null;
  slabs: number;
  slabsDone: number;
  products: string[];
}

export async function fetchSchedules(): Promise<ScheduleSummary[]> {
  const mos = await readScheduledMos();
  const tmplIds = [...new Set(mos.map((m) => m.product_tmpl_id[0]))];
  const skus = await prisma.sku.findMany({ where: { odooTemplateId: { in: tmplIds } }, include: { _count: { select: { pieces: true } } } });
  const skuByTmpl = new Map(skus.map((s) => [s.odooTemplateId, s]));
  const orders = await prisma.foamOrder.findMany({ where: { source: 'schedule' } });
  const orderBySchedule = new Map(orders.map((o) => [o.scheduleNumber, o]));
  const groups = new Map<string, MoRow[]>();
  for (const m of mos) {
    const n = m.x_schedule_number as string;
    groups.set(n, [...(groups.get(n) ?? []), m]);
  }
  return [...groups.entries()]
    .sort((a, b) => natSort(a[0], b[0]))
    .map(([scheduleNumber, list]) => {
      const o = orderBySchedule.get(scheduleNumber);
      const plan = (o?.cutPlan as Record<string, { sheets: unknown[] }> | null) ?? {};
      const slabs = Object.values(plan).reduce((a, p) => a + (p.sheets?.length ?? 0), 0);
      const done = ((o?.cutProgress as { done?: string[] } | null)?.done ?? []).length;
      return {
        scheduleNumber,
        moCount: list.length,
        pieces: list.reduce((a, m) => a + m.product_qty, 0),
        mapped: list.filter((m) => skuByTmpl.has(m.product_tmpl_id[0])).length,
        withPattern: list.filter((m) => (skuByTmpl.get(m.product_tmpl_id[0])?._count.pieces ?? 0) > 0).length,
        orderId: o?.id ?? null,
        status: o?.status ?? null,
        slabs,
        slabsDone: done,
        products: [...new Set(list.map((m) => m.product_id[1].replace(/\s*\([^)]*\)\s*$/, '')))].slice(0, 6),
      };
    });
}

/** Build or refresh the foam order for one production list. Progress on slabs is kept. */
export async function upsertScheduleOrder(scheduleNumber: string) {
  const mos = (await readScheduledMos()).filter((m) => m.x_schedule_number === scheduleNumber);
  const tmplIds = [...new Set(mos.map((m) => m.product_tmpl_id[0]))];
  const skus = await prisma.sku.findMany({ where: { odooTemplateId: { in: tmplIds } } });
  const skuByTmpl = new Map(skus.map((s) => [s.odooTemplateId, s]));
  const lines: OrderLine[] = mos
    .filter((m) => skuByTmpl.has(m.product_tmpl_id[0]))
    .map((m) => {
      const s = skuByTmpl.get(m.product_tmpl_id[0])!;
      return { skuId: s.id, code: s.code, name: m.product_id[1], qty: m.product_qty, moId: m.id, moName: m.name };
    });
  const unmapped = mos.filter((m) => !skuByTmpl.has(m.product_tmpl_id[0])).map((m) => `${m.name} ${m.product_id[1]}`);
  const requirements = await buildRequirements(lines);
  const cutPlan = buildCutPlan(requirements);
  const existing = await prisma.foamOrder.findUnique({ where: { scheduleNumber } });
  const data = {
    name: `List ${scheduleNumber}`,
    source: 'schedule',
    scheduleNumber,
    lines: lines as any,
    requirements: requirements as any,
    cutPlan: cutPlan as any,
    notes: unmapped.length ? `Not synced SKUs (no foam): ${unmapped.join('; ')}` : null,
  };
  const order = existing
    ? await prisma.foamOrder.update({ where: { id: existing.id }, data })
    : await prisma.foamOrder.create({ data: { ...data, status: 'optimized', cutProgress: { done: [] } } });
  return { order, moCount: mos.length, mapped: lines.length, unmapped };
}

export async function saveProgress(orderId: number, done: string[]) {
  const o = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!o) throw new Error('Order not found');
  const plan = (o.cutPlan as Record<string, { sheets: unknown[] }> | null) ?? {};
  const total = Object.values(plan).reduce((a, p) => a + (p.sheets?.length ?? 0), 0);
  const uniq = [...new Set(done)];
  const status = total > 0 && uniq.length >= total ? 'cut' : o.status === 'cut' ? 'optimized' : o.status;
  const updated = await prisma.foamOrder.update({ where: { id: orderId }, data: { cutProgress: { done: uniq, updatedAt: new Date().toISOString() }, status } });
  if (status === 'cut') await logScrapForOrder(orderId).catch((e) => console.error('[scrap] log failed', e));
  return updated;
}
