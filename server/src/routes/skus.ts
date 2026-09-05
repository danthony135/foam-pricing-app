import { Router } from 'express';
import { prisma } from '../index';
import { calculateBoardFeet } from '../utils/boardFeet';
import { computeSkuFoam, pushSkuBom } from '../services/odooSync';

const router = Router();

/** List with pattern status, computed BF vs BF currently in Odoo. */
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.all === '1';
    const skus = await prisma.sku.findMany({
      where: includeInactive ? {} : { active: true },
      include: { pieces: { include: { foam: true } } },
      orderBy: [{ collection: 'asc' }, { code: 'asc' }],
    });
    const rows = skus.map((s) => {
      const bf = s.pieces.reduce((a, p) => a + (p.foam ? calculateBoardFeet(p.lengthIn, p.widthIn, p.heightIn) * p.qty : 0), 0);
      const odooBf = ((s.odooFoamLines as any[]) ?? []).reduce((a, l) => a + (l.qty || 0), 0);
      const unassigned = s.pieces.filter((p) => !p.foamId).length;
      const status = !s.pieces.length ? 'missing' : unassigned ? 'partial' : 'ready';
      return {
        id: s.id, code: s.code, name: s.name, shortName: s.shortName, collection: s.collection, active: s.active,
        odooTemplateId: s.odooTemplateId, odooBomId: s.odooBomId,
        pieceCount: s.pieces.length, netBoardFeet: Math.round(bf * 100) / 100, odooBoardFeet: Math.round(odooBf * 100) / 100,
        status, pushedAt: s.pushedAt, lastSyncedAt: s.lastSyncedAt,
      };
    });
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sku = await prisma.sku.findUnique({ where: { id: +req.params.id }, include: { pieces: { include: { foam: true, dacron: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } });
    if (!sku) return res.status(404).json({ error: 'SKU not found' });
    const foam = await computeSkuFoam(sku.id);
    res.json({ ...sku, foam });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { notes, wastePct } = req.body;
    const sku = await prisma.sku.update({ where: { id: +req.params.id }, data: { notes, wastePct: wastePct === '' || wastePct == null ? null : Number(wastePct) } });
    res.json(sku);
  } catch (err) { next(err); }
});

// ---- pieces ----
function pieceData(b: any) {
  return {
    name: String(b.name ?? '').trim() || 'Piece',
    foamId: b.foamId ? Number(b.foamId) : null,
    lengthIn: Number(b.lengthIn) || 0,
    widthIn: Number(b.widthIn) || 0,
    heightIn: Number(b.heightIn) || 0,
    qty: Math.max(1, Math.round(Number(b.qty) || 1)),
    dacronId: b.dacronId ? Number(b.dacronId) : null,
    wrapDacron: !!b.wrapDacron,
    notes: b.notes ?? null,
    sortOrder: Number(b.sortOrder) || 0,
  };
}

router.post('/:id/pieces', async (req, res, next) => {
  try {
    const piece = await prisma.foamPiece.create({ data: { skuId: +req.params.id, ...pieceData(req.body) } });
    res.status(201).json(piece);
  } catch (err) { next(err); }
});

router.put('/:id/pieces/:pieceId', async (req, res, next) => {
  try {
    const piece = await prisma.foamPiece.update({ where: { id: +req.params.pieceId }, data: pieceData(req.body) });
    res.json(piece);
  } catch (err) { next(err); }
});

router.delete('/:id/pieces/:pieceId', async (req, res, next) => {
  try {
    await prisma.foamPiece.delete({ where: { id: +req.params.pieceId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

/** Copy another SKU's pieces onto this one (same collection, different width, etc.). */
router.post('/:id/copy-from/:sourceId', async (req, res, next) => {
  try {
    const src = await prisma.foamPiece.findMany({ where: { skuId: +req.params.sourceId } });
    if (req.body?.replace) await prisma.foamPiece.deleteMany({ where: { skuId: +req.params.id } });
    await prisma.foamPiece.createMany({ data: src.map(({ id: _id, skuId: _s, createdAt: _c, updatedAt: _u, ...p }) => ({ ...p, skuId: +req.params.id })) });
    res.json({ copied: src.length });
  } catch (err) { next(err); }
});

/**
 * Bulk import pieces: rows of {code, piece, foam (grade or thickness), length, width, height, qty, dacron}.
 * Matches SKU by code and foam by grade text or thickness number. Existing pieces of a SKU are replaced.
 */
router.post('/import-pieces', async (req, res, next) => {
  try {
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const foams = await prisma.foam.findMany();
    const skus = await prisma.sku.findMany({ select: { id: true, code: true } });
    const skuByCode = new Map(skus.map((s) => [s.code.toUpperCase(), s.id]));
    const grouped = new Map<number, any[]>();
    const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const code = String(r.code ?? r.sku ?? '').trim().toUpperCase();
      const skuId = skuByCode.get(code);
      if (!skuId) { errors.push(`Row ${i + 1}: unknown SKU code "${code}"`); continue; }
      const foamText = String(r.foam ?? r.grade ?? r.thickness ?? '').trim();
      let foam = foams.find((f) => f.grade.toLowerCase() === foamText.toLowerCase());
      if (!foam && foamText) {
        const t = parseFloat(foamText);
        if (!Number.isNaN(t)) foam = foams.find((f) => f.thicknessIn === t);
      }
      grouped.set(skuId, [...(grouped.get(skuId) ?? []), {
        name: String(r.piece ?? r.name ?? 'Piece'), foamId: foam?.id ?? null,
        lengthIn: Number(r.length ?? r.lengthIn) || 0, widthIn: Number(r.width ?? r.widthIn) || 0, heightIn: Number(r.height ?? r.heightIn ?? r.thickness) || foam?.thicknessIn || 0,
        qty: Math.max(1, Math.round(Number(r.qty) || 1)), wrapDacron: /^(y|yes|true|1)$/i.test(String(r.dacron ?? '')), sortOrder: i,
      }]);
    }
    let imported = 0;
    for (const [skuId, pieces] of grouped) {
      await prisma.foamPiece.deleteMany({ where: { skuId } });
      await prisma.foamPiece.createMany({ data: pieces.map((p) => ({ ...p, skuId })) });
      imported += pieces.length;
    }
    res.json({ skus: grouped.size, pieces: imported, errors });
  } catch (err) { next(err); }
});

router.post('/:id/push', async (req, res, next) => {
  try {
    res.json(await pushSkuBom(+req.params.id));
  } catch (err) { next(err); }
});

export default router;
