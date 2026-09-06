import { Router } from 'express';
import { prisma } from '../index';
import { odooConfigured } from '../services/odoo';
import { fetchOpenMos, getSetting, setSetting, syncFoamMaterials, syncSkus, DEFAULT_VENDOR_ID, DEFAULT_WASTE_PCT } from '../services/odooSync';
import { fetchSchedules } from '../services/scheduleOrders';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    const [skuCount, withPattern, foamCount] = await Promise.all([
      prisma.sku.count({ where: { active: true } }),
      prisma.sku.count({ where: { active: true, pieces: { some: {} } } }),
      prisma.foam.count({ where: { odooTemplateId: { not: null } } }),
    ]);
    res.json({
      configured: odooConfigured(),
      url: process.env.ODOO_URL || null,
      skusSyncedAt: await getSetting<string | null>('odoo.skusSyncedAt', null),
      materialsSyncedAt: await getSetting<string | null>('odoo.materialsSyncedAt', null),
      foamVendorId: await getSetting<number>('odoo.foamVendorId', DEFAULT_VENDOR_ID),
      wastePct: await getSetting<number>('foam.wastePct', DEFAULT_WASTE_PCT),
      skuCount, withPattern, foamCount,
    });
  } catch (err) { next(err); }
});

router.put('/settings', async (req, res, next) => {
  try {
    if (req.body.foamVendorId != null) await setSetting('odoo.foamVendorId', Number(req.body.foamVendorId));
    if (req.body.wastePct != null) await setSetting('foam.wastePct', Number(req.body.wastePct));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/sync/materials', async (_req, res, next) => {
  try { res.json(await syncFoamMaterials()); } catch (err) { next(err); }
});

router.post('/sync/skus', async (req, res, next) => {
  try { res.json(await syncSkus({ includeArchived: req.body?.includeArchived })); } catch (err) { next(err); }
});

router.post('/sync/all', async (_req, res, next) => {
  try {
    const materials = await syncFoamMaterials();
    const skus = await syncSkus();
    res.json({ materials, skus });
  } catch (err) { next(err); }
});

router.get('/mos', async (req, res, next) => {
  try {
    const states = typeof req.query.states === 'string' ? req.query.states.split(',') : undefined;
    res.json(await fetchOpenMos({ states }));
  } catch (err) { next(err); }
});

router.get('/schedules', async (_req, res, next) => {
  try { res.json(await fetchSchedules()); } catch (err) { next(err); }
});

export default router;
