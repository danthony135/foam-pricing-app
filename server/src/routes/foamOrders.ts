import { Router } from 'express';
import { prisma } from '../index';
import { buildCutPlan, buildRequirements, type OrderLine } from '../services/foamRequirements';
import { createFoamRfq, fetchOpenMos } from '../services/odooSync';
import { saveProgress, upsertScheduleOrder } from '../services/scheduleOrders';
import { logScrapForOrder } from '../services/scrap';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const orders = await prisma.foamOrder.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(orders.map((o) => ({ ...o, lineCount: (o.lines as any[]).length, boardFeet: ((o.requirements as any[]) ?? []).reduce((a, r) => a + (r.boardFeet || 0), 0) })));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const o = await prisma.foamOrder.findUnique({ where: { id: +req.params.id } });
    if (!o) return res.status(404).json({ error: 'Order not found' });
    res.json(o);
  } catch (err) { next(err); }
});

/**
 * Create from typed lines [{skuId, qty}] or from Odoo MO ids. Requirements and
 * the cut plan are computed immediately so the order opens ready to read.
 */
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim() || `Foam order ${new Date().toISOString().slice(0, 10)}`;
    let lines: OrderLine[] = [];
    let source = 'manual';
    if (Array.isArray(req.body?.moIds) && req.body.moIds.length) {
      source = 'mo';
      const wanted = new Set<number>(req.body.moIds.map(Number));
      const mos = (await fetchOpenMos({ states: ['draft', 'confirmed', 'progress'] })).filter((m) => wanted.has(m.moId));
      lines = mos.filter((m) => m.skuId).map((m) => ({ skuId: m.skuId as number, code: m.code as string, name: m.product, qty: m.qty, moId: m.moId, moName: m.moName }));
    } else if (Array.isArray(req.body?.lines)) {
      const skus = await prisma.sku.findMany({ where: { id: { in: req.body.lines.map((l: any) => Number(l.skuId)) } } });
      lines = req.body.lines.map((l: any) => {
        const s = skus.find((x) => x.id === Number(l.skuId));
        return s ? { skuId: s.id, code: s.code, name: s.name, qty: Math.max(1, Number(l.qty) || 1) } : null;
      }).filter(Boolean);
    }
    if (!lines.length) return res.status(400).json({ error: 'No SKU lines (do the chosen MOs map to synced SKUs?)' });
    const requirements = await buildRequirements(lines);
    const cutPlan = buildCutPlan(requirements);
    const order = await prisma.foamOrder.create({ data: { name, source, lines: lines as any, requirements: requirements as any, cutPlan: cutPlan as any, status: 'optimized', notes: req.body?.notes ?? null } });
    res.status(201).json(order);
  } catch (err) { next(err); }
});

/** Build or refresh the order for a FurnitureSuite production list (schedule number). */
router.post('/from-schedule', async (req, res, next) => {
  try {
    const n = String(req.body?.scheduleNumber ?? '').trim();
    if (!n) return res.status(400).json({ error: 'scheduleNumber required' });
    res.json(await upsertScheduleOrder(n));
  } catch (err) { next(err); }
});

/** Slab progress from the cut station (server-side so any screen shows the same state). */
router.put('/:id/progress', async (req, res, next) => {
  try {
    res.json(await saveProgress(+req.params.id, Array.isArray(req.body?.done) ? req.body.done.map(String) : []));
  } catch (err) { next(err); }
});

/** Recompute after patterns or stock changed. */
router.post('/:id/optimize', async (req, res, next) => {
  try {
    const o = await prisma.foamOrder.findUnique({ where: { id: +req.params.id } });
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (o.source === 'schedule' && o.scheduleNumber) return res.json((await upsertScheduleOrder(o.scheduleNumber)).order);
    const requirements = await buildRequirements(o.lines as any);
    const cutPlan = buildCutPlan(requirements);
    res.json(await prisma.foamOrder.update({ where: { id: o.id }, data: { requirements: requirements as any, cutPlan: cutPlan as any, status: o.status === 'draft' ? 'optimized' : o.status } }));
  } catch (err) { next(err); }
});

router.post('/:id/rfq', async (req, res, next) => {
  try { res.json(await createFoamRfq(+req.params.id, { full: !!req.body?.full })); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { status, notes, name } = req.body;
    const o = await prisma.foamOrder.update({ where: { id: +req.params.id }, data: { status, notes, name } });
    if (status === 'cut' || status === 'done') await logScrapForOrder(o.id).catch((e) => console.error('[scrap] log failed', e));
    res.json(o);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.foamOrder.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
