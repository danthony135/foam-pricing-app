/**
 * Re-nest one slab of a cut plan to its MEASURED size. The overhead camera
 * (or a tape) says the slab on the table is not the nominal 82 × 36 — maybe it
 * is short, maybe a corner is missing. The pieces planned for that slab are
 * packed onto the measured stock; whatever no longer fits joins the pieces of
 * the remaining unticked slabs of that foam and is re-nested after it. Slabs
 * already ticked off are frozen (kept verbatim, renumbered first) exactly like
 * a remnant claim, and the progress keys / shelved remnants follow.
 */
import { prisma } from '../index';
import { packPieces, type CutPiece, type CutPlan, type PlacedPiece, type Sheet } from './cutOptimizer';
import { isValid, normalize, rotate, round, type Poly } from './geometry';

export interface MeasuredStock {
  lengthIn: number;
  widthIn: number;
  poly?: Poly | null; // measured outline (inches, y-down); omitted = rectangle
  x?: number; // where the slab sits relative to the table origin (inches)
  y?: number;
}

/** The whole pieces on a sheet as nest input (glue parts folded back, outlines at rotation 0). */
export function piecesOfSheet(s: Sheet): CutPiece[] {
  const out: CutPiece[] = [];
  for (const p of s.pieces as PlacedPiece[]) {
    if (p.glue && p.glue.part !== 'A') continue;
    const l = p.glue ? p.glue.wholeL : p.rotated ? p.h : p.w;
    const w = p.glue ? p.glue.wholeW : p.rotated ? p.w : p.h;
    const poly = p.glue || !p.poly ? undefined : normalize(rotate(p.poly, (360 - (p.rot ?? 0)) % 360));
    out.push({ label: p.label, l: round(l, 2), w: round(w, 2), qty: 1, poly, mo: p.mo });
  }
  return out;
}

export async function resizeSlab(orderId: number, foamId: number, slabIndex: number, meas: MeasuredStock) {
  const o = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!o || !o.cutPlan) throw new Error('Order not found');
  const plan = o.cutPlan as unknown as Record<string, CutPlan>;
  const p = plan[String(foamId)];
  if (!p) throw new Error('No plan for that foam');
  const done = new Set(((o.cutProgress as { done?: string[] } | null)?.done ?? []).map(String));
  if (done.has(`${foamId}-${slabIndex}`)) throw new Error('That slab is already marked cut');
  const target = p.sheets.find((s) => s.index === slabIndex);
  if (!target) throw new Error('Slab not found');
  if (!(meas.lengthIn > 0 && meas.widthIn > 0)) throw new Error('Measured length and width required');

  const kept = p.sheets.filter((s) => done.has(`${foamId}-${s.index}`));
  const others = p.sheets.filter((s) => !done.has(`${foamId}-${s.index}`) && s.index !== slabIndex);

  // Pack the slab's own pieces onto the measured stock.
  const stockPoly = isValid(meas.poly) ? normalize(meas.poly as Poly) : undefined;
  const own = piecesOfSheet(target);
  const first = packPieces(own, meas.lengthIn, meas.widthIn, { glue: false, stockPoly, maxSheets: 1 });
  const placedLabels = new Map<string, number>();
  for (const s of first.sheets) for (const pp of s.pieces) { const k = `${pp.label}|${pp.mo ?? ''}`; placedLabels.set(k, (placedLabels.get(k) ?? 0) + 1); }
  const overflow = own.filter((c) => {
    const k = `${c.label}|${c.mo ?? ''}`;
    const n = placedLabels.get(k) ?? 0;
    if (n > 0) { placedLabels.set(k, n - 1); return false; }
    return true;
  });

  // Everything else still to cut, plus the overflow, on nominal slabs.
  const rest = packPieces([...others.flatMap(piecesOfSheet), ...overflow], p.sheetLength, p.sheetWidth);

  const renumber: { from: number; to: number }[] = [];
  kept.forEach((s, i) => { renumber.push({ from: s.index, to: i + 1 }); s.index = i + 1; });
  const measured: Sheet[] = first.sheets.map((s) => ({
    ...s,
    index: kept.length + 1,
    stock: { length: round(meas.lengthIn, 2), width: round(meas.widthIn, 2), ...(stockPoly ? { poly: stockPoly } : {}), ...(meas.x ? { x: round(meas.x, 2) } : {}), ...(meas.y ? { y: round(meas.y, 2) } : {}) },
  }));
  rest.sheets.forEach((s, i) => { s.index = kept.length + measured.length + i + 1; });
  const sheets = [...kept, ...measured, ...rest.sheets];
  const sheetArea = p.sheetLength * p.sheetWidth;
  const used = sheets.reduce((a, s) => a + s.usedArea, 0);
  plan[String(foamId)] = {
    ...p,
    sheets,
    pieceCount: sheets.reduce((a, s) => a + s.pieces.filter((x) => !x.glue || x.glue.part === 'A').length, 0),
    gluedPieces: sheets.reduce((a, s) => a + s.pieces.filter((x) => x.glue?.part === 'A').length, 0),
    unplaced: [...(p.unplaced ?? []), ...rest.unplaced],
    utilization: sheets.length ? used / (sheets.length * sheetArea) : 0,
    scrapSqIn: round(sheets.reduce((a, s) => a + (s.scrapSqIn ?? 0), 0), 1),
  };
  const newDone = [...done].map((k) => {
    const [f, i] = k.split('-');
    if (Number(f) !== foamId) return k;
    const r = renumber.find((x) => x.from === Number(i));
    return r ? `${f}-${r.to}` : k;
  });
  const updated = await prisma.foamOrder.update({
    where: { id: orderId },
    data: { cutPlan: plan as any, cutProgress: { done: newDone, updatedAt: new Date().toISOString() } as any },
  });
  const shelved = await prisma.remnant.findMany({ where: { foamOrderId: orderId, foamId, source: 'cut', parentId: null } });
  for (const m of shelved) {
    const r = renumber.find((x) => x.from === m.slabIndex);
    if (r && r.to !== m.slabIndex) await prisma.remnant.update({ where: { id: m.id }, data: { slabIndex: r.to } });
  }
  return { order: updated, slabIndex: kept.length + 1, placed: first.pieceCount, overflow: overflow.length, newSlabs: rest.sheets.length };
}
