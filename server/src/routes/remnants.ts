import { Router } from 'express';
import { prisma } from '../index';
import { claimRemnant, createRemnant, listRemnants, matchRemnant, nestChosen, resolveExtra } from '../services/remnants';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listRemnants({ foamId: req.query.foamId ? Number(req.query.foamId) : undefined, status: req.query.status ? String(req.query.status) : undefined }));
  } catch (err) { next(err); }
});

/** Scanned or typed remnant: { foamId, lengthIn, widthIn } or { foamId, shape: [[x,y],…] inches }. */
router.post('/', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.foamId) return res.status(400).json({ error: 'foamId required' });
    const m = await createRemnant({ foamId: Number(b.foamId), lengthIn: b.lengthIn, widthIn: b.widthIn, shape: b.shape ?? null, source: b.shape ? 'scanned' : 'manual', notes: b.notes ?? null });
    res.status(201).json(m);
  } catch (err) { next(err); }
});

/** What can be cut from a remnant: by id, or from a geometry not saved yet ({foamId, lengthIn, widthIn | shape}). */
router.post('/match', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (b.remnantId) {
      const m = await prisma.remnant.findUnique({ where: { id: Number(b.remnantId) } });
      if (!m) return res.status(404).json({ error: 'Remnant not found' });
      return res.json(await matchRemnant(m.foamId, { lengthIn: m.lengthIn, widthIn: m.widthIn, shape: m.shape as any }));
    }
    if (!b.foamId) return res.status(400).json({ error: 'foamId required' });
    res.json(await matchRemnant(Number(b.foamId), { lengthIn: b.lengthIn, widthIn: b.widthIn, shape: b.shape ?? null }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.remnant.findUnique({ where: { id: +req.params.id }, include: { foam: true } });
    if (!m) return res.status(404).json({ error: 'Remnant not found' });
    res.json({ ...m, tag: `R-${m.id}` });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { status, notes, foamId } = req.body ?? {};
    const data: any = {};
    if (status) { data.status = status; if (status === 'used' || status === 'discarded') data.usedAt = new Date(); }
    if (notes !== undefined) data.notes = notes;
    if (foamId) data.foamId = Number(foamId);
    res.json(await prisma.remnant.update({ where: { id: +req.params.id }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await prisma.remnant.delete({ where: { id: +req.params.id } }); res.json({ success: true }); } catch (err) { next(err); }
});

/** Re-nest a chosen subset onto the remnant (the picture updates as the operator ticks pieces on/off). */
router.post('/:id/preview', async (req, res, next) => {
  try {
    const m = await prisma.remnant.findUnique({ where: { id: +req.params.id } });
    if (!m) return res.status(404).json({ error: 'Remnant not found' });
    const picks = Array.isArray(req.body?.picks) ? req.body.picks : [];
    const extra = await resolveExtra(Array.isArray(req.body?.extra) ? req.body.extra : []);
    res.json({ plan: await nestChosen(m, picks, extra) });
  } catch (err) { next(err); }
});

/** The operator cut these pieces from the remnant. Body: { picks: [{label, mo?, qty, orderId}], extra?: [{skuId?, piece?, label, l, w, qty}] } */
router.post('/:id/claim', async (req, res, next) => {
  try {
    const picks = Array.isArray(req.body?.picks) ? req.body.picks.filter((p: any) => p.qty > 0) : [];
    const extra = await resolveExtra(Array.isArray(req.body?.extra) ? req.body.extra.filter((e: any) => e.qty > 0) : []);
    if (!picks.length && !extra.length) return res.status(400).json({ error: 'Nothing picked' });
    res.json(await claimRemnant(+req.params.id, picks, extra));
  } catch (err) { next(err); }
});

export default router;
