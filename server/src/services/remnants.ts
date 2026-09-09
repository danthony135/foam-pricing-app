/**
 * Remnants — the leftover foam the shop keeps.
 *
 *  • When a slab is ticked off on the cut station, its largest free rectangles
 *    become `Remnant` rows (source "cut"), so the app remembers what is on the
 *    scrap rack list by list. Un-ticking a slab removes them again (if unused).
 *  • Any other piece on the rack can be scanned (photo → outline, scaled by a
 *    tape measurement) or typed in as L × W (source "scanned" / "manual").
 *  • Matching nests the pieces still to be cut on OPEN production lists onto the
 *    remnant's real outline (one sheet, no glue-ups) and also lists every
 *    library pattern of that foam that fits, for cutting ahead.
 *  • Claiming marks the remnant used, records the pieces on the order as
 *    `remnantCuts` (so its slab plan is rebuilt without them), and saves the
 *    remnant's own leftovers as new remnants.
 */
import { prisma } from '../index';
import { packPieces, type CutPiece, type CutPlan, type PlacedPiece } from './cutOptimizer';
import { area, bbox, isValid, normalize, rectPoly, rotate, round, type Poly } from './geometry';
import { type RemnantCut } from './foamRequirements';

const MIN_SIDE_IN = 6; // smaller than this is not worth shelving
const MIN_AREA_SQIN = 144; // one square foot

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RemnantInput {
  foamId: number;
  lengthIn?: number;
  widthIn?: number;
  shape?: Poly | null; // inches, y-down; normalized here
  source?: string;
  notes?: string | null;
  foamOrderId?: number | null;
  scheduleNumber?: string | null;
  slabIndex?: number | null;
  parentId?: number | null;
}

/** Normalize a remnant description into the row shape (bbox, area, polygon or rect). */
export function describeRemnant(input: RemnantInput) {
  const poly = isValid(input.shape) ? normalize(input.shape as Poly) : null;
  const b = poly ? bbox(poly) : null;
  const lengthIn = r2(b ? b.w : Number(input.lengthIn));
  const widthIn = r2(b ? b.h : Number(input.widthIn));
  if (!(lengthIn > 0 && widthIn > 0)) throw new Error('Remnant needs a length and width (inches) or an outline');
  // Treat an outline that is basically its own bbox as a plain rectangle.
  const isRect = !poly || area(poly) >= lengthIn * widthIn * 0.985;
  return {
    lengthIn,
    widthIn,
    shapeType: isRect ? 'rect' : 'polygon',
    shape: isRect ? null : poly,
    areaSqIn: r2(poly ? area(poly) : lengthIn * widthIn),
  };
}

export async function createRemnant(input: RemnantInput) {
  const d = describeRemnant(input);
  return prisma.remnant.create({
    data: {
      foamId: input.foamId,
      source: input.source ?? 'manual',
      ...d,
      shape: d.shape as any,
      notes: input.notes ?? null,
      foamOrderId: input.foamOrderId ?? null,
      scheduleNumber: input.scheduleNumber ?? null,
      slabIndex: input.slabIndex ?? null,
      parentId: input.parentId ?? null,
    },
  });
}

/**
 * Keep the "cut" remnants of an order in step with its ticked slabs: every done
 * slab has its usable free rectangles on file; slabs no longer ticked lose
 * theirs (unless one was already used). Idempotent.
 */
export async function syncCutRemnants(orderId: number) {
  const o = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!o) return { created: 0, removed: 0 };
  const plan = (o.cutPlan as Record<string, CutPlan> | null) ?? {};
  const done = new Set(((o.cutProgress as { done?: string[] } | null)?.done ?? []).map(String));
  const existing = await prisma.remnant.findMany({ where: { foamOrderId: orderId, source: 'cut', parentId: null } });
  let created = 0, removed = 0;
  // Remove remnants for slabs that are no longer ticked (only if still available).
  const stale = existing.filter((m) => !done.has(`${m.foamId}-${m.slabIndex}`) && m.status === 'available');
  if (stale.length) {
    await prisma.remnant.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
    removed = stale.length;
  }
  for (const key of done) {
    const [foamIdS, slabS] = key.split('-');
    const foamId = Number(foamIdS), slabIndex = Number(slabS);
    if (existing.some((m) => m.foamId === foamId && m.slabIndex === slabIndex)) continue;
    const sheet = plan[foamId]?.sheets?.find((s) => s.index === slabIndex);
    if (!sheet) continue;
    for (const m of sheet.remnants ?? []) {
      if (Math.min(m.w, m.h) < MIN_SIDE_IN || m.w * m.h < MIN_AREA_SQIN) continue;
      await createRemnant({ foamId, lengthIn: Math.max(m.w, m.h), widthIn: Math.min(m.w, m.h), source: 'cut', foamOrderId: orderId, scheduleNumber: o.scheduleNumber ?? null, slabIndex, notes: `Slab ${slabIndex} of ${o.name}` });
      created++;
    }
  }
  return { created, removed };
}

export async function listRemnants(opts: { foamId?: number; status?: string } = {}) {
  const rows = await prisma.remnant.findMany({
    where: { ...(opts.foamId ? { foamId: opts.foamId } : {}), ...(opts.status ? { status: opts.status } : {}) },
    include: { foam: { select: { grade: true, thicknessIn: true, costPerBoardFoot: true } } },
    orderBy: [{ status: 'asc' }, { areaSqIn: 'desc' }],
  });
  return rows.map((m) => ({ ...m, tag: `R-${m.id}`, boardFeet: r2((m.areaSqIn * (m.foam.thicknessIn ?? 1)) / 144) }));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------
export interface Candidate extends CutPiece {
  orderId: number;
  orderName: string;
  scheduleNumber: string | null;
}

/** Piece outline at rotation 0, normalized, from a placed piece on a plan. */
function unplacedPoly(p: PlacedPiece): Poly | undefined {
  if (!p.poly) return undefined;
  return normalize(rotate(p.poly, (360 - (p.rot ?? 0)) % 360));
}

/**
 * Everything still to be cut for `foamId` on open production lists: the pieces
 * on slabs that have not been ticked off. Glue parts are folded back into
 * their whole piece (a remnant cut is always whole).
 */
async function openPieces(foamId: number): Promise<Candidate[]> {
  const orders = await prisma.foamOrder.findMany({ where: { status: { notIn: ['done', 'cut'] } }, orderBy: [{ scheduleNumber: 'asc' }, { createdAt: 'asc' }] });
  const out: Candidate[] = [];
  for (const o of orders) {
    const plan = (o.cutPlan as Record<string, CutPlan> | null)?.[foamId];
    if (!plan) continue;
    const done = new Set(((o.cutProgress as { done?: string[] } | null)?.done ?? []).map(String));
    const agg = new Map<string, Candidate>();
    for (const s of plan.sheets) {
      if (done.has(`${foamId}-${s.index}`)) continue;
      for (const p of s.pieces) {
        if (p.glue && p.glue.part !== 'A') continue;
        const l = p.glue ? p.glue.wholeL : p.rotated ? p.h : p.w;
        const w = p.glue ? p.glue.wholeW : p.rotated ? p.w : p.h;
        const poly = p.glue ? undefined : unplacedPoly(p);
        const k = `${p.label}|${p.mo ?? ''}`;
        const c = agg.get(k) ?? { label: p.label, l: round(l, 2), w: round(w, 2), qty: 0, poly, mo: p.mo, orderId: o.id, orderName: o.name, scheduleNumber: o.scheduleNumber ?? null, noGlue: true };
        c.qty++;
        agg.set(k, c);
      }
    }
    out.push(...agg.values());
  }
  return out;
}

export interface MatchResult {
  remnant: { lengthIn: number; widthIn: number; shape: Poly | null; areaSqIn: number };
  plan: CutPlan; // one sheet = the remnant, pieces nested onto it
  picks: { label: string; mo?: string; qty: number; orderId: number; orderName: string; scheduleNumber: string | null; l: number; w: number }[];
  openCount: number; // how many open-list pieces (of this foam) were considered
  libraryFits: { skuId: number; code: string; name: string; piece: string; l: number; w: number; shaped: boolean; maxQty: number }[];
}

/** Nest what is needed now onto the remnant, and list every library pattern that fits. */
export async function matchRemnant(foamId: number, geometry: { lengthIn?: number; widthIn?: number; shape?: Poly | null }): Promise<MatchResult> {
  const d = describeRemnant({ foamId, ...geometry });
  const stock = d.shape ?? rectPoly(d.lengthIn, d.widthIn);
  const cands = await openPieces(foamId);
  const plan = packPieces(cands, d.lengthIn, d.widthIn, { glue: false, stockPoly: stock, maxSheets: 1 });
  const picks = new Map<string, MatchResult['picks'][number]>();
  for (const s of plan.sheets)
    for (const p of s.pieces) {
      const k = `${p.label}|${p.mo ?? ''}`;
      const c = cands.find((x) => x.label === p.label && (x.mo ?? '') === (p.mo ?? ''))!;
      const e = picks.get(k) ?? { label: p.label, mo: p.mo, qty: 0, orderId: c.orderId, orderName: c.orderName, scheduleNumber: c.scheduleNumber, l: c.l, w: c.w };
      e.qty++;
      picks.set(k, e);
    }

  // Library: every distinct pattern piece of this foam that fits at least once, with how many would.
  const pieces = await prisma.foamPiece.findMany({ where: { foamId, sku: { active: true } }, include: { sku: { select: { id: true, code: true, name: true } } } });
  const libraryFits: MatchResult['libraryFits'] = [];
  const seen = new Set<string>();
  for (const p of pieces) {
    const poly = p.shapeType === 'polygon' && isValid(p.shape) ? (p.shape as Poly) : undefined;
    const key = `${p.sku.code}|${p.name}|${p.lengthIn}x${p.widthIn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fitsBox = (p.lengthIn <= d.lengthIn && p.widthIn <= d.widthIn) || (p.widthIn <= d.lengthIn && p.lengthIn <= d.widthIn);
    if (!fitsBox) continue;
    const trial = packPieces([{ label: p.name, l: p.lengthIn, w: p.widthIn, qty: 12, poly, noGlue: true }], d.lengthIn, d.widthIn, { glue: false, stockPoly: stock, maxSheets: 1 });
    const n = trial.sheets[0]?.pieces.length ?? 0;
    if (n > 0) libraryFits.push({ skuId: p.sku.id, code: p.sku.code, name: p.sku.name, piece: p.name, l: p.lengthIn, w: p.widthIn, shaped: !!poly, maxQty: n });
  }
  libraryFits.sort((a, b) => b.l * b.w - a.l * a.w);

  return { remnant: { lengthIn: d.lengthIn, widthIn: d.widthIn, shape: d.shape, areaSqIn: d.areaSqIn }, plan, picks: [...picks.values()], openCount: cands.reduce((a, c) => a + c.qty, 0), libraryFits };
}

/**
 * Take newly remnant-cut pieces off an order's slab plan without disturbing the
 * slabs the operator has already ticked off: those sheets are kept verbatim
 * (renumbered first), the pieces on the remaining sheets minus `newCuts` are
 * re-nested after them, and the progress keys follow the renumbering. The full
 * list of cuts is stored so a later full rebuild (Refresh from Odoo) also
 * leaves them out.
 */
export async function removeCutsFromPlan(orderId: number, newCuts: RemnantCut[]) {
  const o = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!o || !o.cutPlan) return;
  const plan = o.cutPlan as unknown as Record<string, CutPlan>;
  const done = new Set(((o.cutProgress as { done?: string[] } | null)?.done ?? []).map(String));
  const left = new Map<string, number>();
  for (const c of newCuts) { const k = `${c.label}|${c.mo ?? ''}`; left.set(k, (left.get(k) ?? 0) + c.qty); }
  const newDone: string[] = [];
  const newPlan: Record<string, CutPlan> = {};
  const renumber: { foamId: number; from: number; to: number }[] = [];
  for (const foamIdS of Object.keys(plan)) {
    const foamId = Number(foamIdS);
    const p = plan[foamIdS];
    const kept = p.sheets.filter((s) => done.has(`${foamId}-${s.index}`));
    const rest = p.sheets.filter((s) => !done.has(`${foamId}-${s.index}`));
    // Pieces still to cut on the unticked slabs, glue parts folded back into whole pieces.
    const pieces: CutPiece[] = [];
    for (const s of rest)
      for (const pp of s.pieces) {
        if (pp.glue && pp.glue.part !== 'A') continue;
        const k = `${pp.label}|${pp.mo ?? ''}`;
        if ((left.get(k) ?? 0) > 0) { left.set(k, left.get(k)! - 1); continue; }
        const l = pp.glue ? pp.glue.wholeL : pp.rotated ? pp.h : pp.w;
        const w = pp.glue ? pp.glue.wholeW : pp.rotated ? pp.w : pp.h;
        pieces.push({ label: pp.label, l: round(l, 2), w: round(w, 2), qty: 1, poly: pp.glue ? undefined : unplacedPoly(pp), mo: pp.mo });
      }
    const np = packPieces(pieces, p.sheetLength, p.sheetWidth);
    kept.forEach((s, i) => { renumber.push({ foamId, from: s.index, to: i + 1 }); s.index = i + 1; newDone.push(`${foamId}-${i + 1}`); });
    np.sheets.forEach((s, i) => { s.index = kept.length + i + 1; });
    const sheets = [...kept, ...np.sheets];
    const sheetArea = p.sheetLength * p.sheetWidth;
    const used = sheets.reduce((a, s) => a + s.usedArea, 0);
    newPlan[foamIdS] = {
      ...np,
      sheets,
      pieceCount: kept.reduce((a, s) => a + s.pieces.filter((x) => !x.glue || x.glue.part === 'A').length, 0) + np.pieceCount,
      gluedPieces: kept.reduce((a, s) => a + s.pieces.filter((x) => x.glue?.part === 'A').length, 0) + np.gluedPieces,
      utilization: sheets.length ? used / (sheets.length * sheetArea) : 0,
      scrapSqIn: round(sheets.reduce((a, s) => a + (s.scrapSqIn ?? 0), 0), 1),
    };
  }
  const all = [...(((o.remnantCuts as any[]) ?? []) as RemnantCut[]), ...newCuts];
  await prisma.foamOrder.update({
    where: { id: orderId },
    data: { remnantCuts: all as any, cutPlan: newPlan as any, cutProgress: { done: newDone, updatedAt: new Date().toISOString() } as any },
  });
  // The remnants shelved from the kept slabs follow the renumbering.
  const shelved = await prisma.remnant.findMany({ where: { foamOrderId: orderId, source: 'cut', parentId: null } });
  for (const m of shelved) {
    const r = renumber.find((x) => x.foamId === m.foamId && x.from === m.slabIndex);
    if (r && r.to !== m.slabIndex) await prisma.remnant.update({ where: { id: m.id }, data: { slabIndex: r.to } });
  }
}

/**
 * The operator cut `picks` from remnant `id`. Records them on their orders (so
 * the slab plans drop them), marks the remnant used, and shelves what is left
 * of the remnant as new remnants.
 */
export type Pick = { label: string; mo?: string; qty: number; orderId: number };
export type ExtraPiece = { label: string; l: number; w: number; qty: number; poly?: Poly };

/** Nest exactly the chosen pieces onto a remnant (preview for the operator, and the claim's record). */
export async function nestChosen(m: { foamId: number; lengthIn: number; widthIn: number; shape: unknown }, picks: Pick[], extra: ExtraPiece[]) {
  const cands = await openPieces(m.foamId);
  const chosen: CutPiece[] = [];
  for (const pk of picks) {
    const c = cands.find((x) => x.label === pk.label && (x.mo ?? '') === (pk.mo ?? '') && x.orderId === pk.orderId);
    if (c && pk.qty > 0) chosen.push({ ...c, qty: Math.min(pk.qty, c.qty) });
  }
  for (const e of extra) if (e.qty > 0) chosen.push({ label: e.label, l: e.l, w: e.w, qty: e.qty, poly: e.poly, noGlue: true });
  const stock = isValid(m.shape) ? (m.shape as Poly) : rectPoly(m.lengthIn, m.widthIn);
  return packPieces(chosen, m.lengthIn, m.widthIn, { glue: false, stockPoly: stock, maxSheets: 1 });
}

/** Library pieces chosen for cutting ahead come with their outline from the pattern. */
export async function resolveExtra(extra: { skuId?: number; piece?: string; label: string; l: number; w: number; qty: number }[]): Promise<ExtraPiece[]> {
  const out: ExtraPiece[] = [];
  for (const e of extra) {
    let poly: Poly | undefined;
    if (e.skuId && e.piece) {
      const fp = await prisma.foamPiece.findFirst({ where: { skuId: e.skuId, name: e.piece } });
      if (fp && fp.shapeType === 'polygon' && isValid(fp.shape)) poly = fp.shape as Poly;
    }
    out.push({ label: e.label, l: e.l, w: e.w, qty: e.qty, poly });
  }
  return out;
}

export async function claimRemnant(id: number, picks: Pick[], extra: ExtraPiece[] = []) {
  const m = await prisma.remnant.findUnique({ where: { id } });
  if (!m) throw new Error('Remnant not found');
  if (m.status !== 'available') throw new Error(`Remnant R-${id} is already ${m.status}`);
  const at = new Date().toISOString();

  // Re-nest the chosen pieces onto the remnant to know what is left of it.
  const plan = await nestChosen(m, picks, extra);

  // Record on each order and take the pieces off its slab plan. Slabs already
  // ticked off stay exactly as they were cut; only the unticked ones re-nest.
  const byOrder = new Map<number, RemnantCut[]>();
  for (const pk of picks) {
    if (!pk.qty) continue;
    byOrder.set(pk.orderId, [...(byOrder.get(pk.orderId) ?? []), { label: pk.label, mo: pk.mo, qty: pk.qty, remnantId: id, at }]);
  }
  for (const [orderId, cuts] of byOrder) await removeCutsFromPlan(orderId, cuts);

  const used = await prisma.remnant.update({
    where: { id },
    data: { status: 'used', usedAt: new Date(), usedOrderId: picks[0]?.orderId ?? null, usedFor: [...picks.map((p) => ({ label: p.label, mo: p.mo, qty: p.qty })), ...extra.map((e) => ({ label: e.label, qty: e.qty }))] as any },
  });

  // Leftovers of the remnant become remnants themselves.
  const children = [] as any[];
  for (const s of plan.sheets)
    for (const r of s.remnants ?? []) {
      if (Math.min(r.w, r.h) < MIN_SIDE_IN || r.w * r.h < MIN_AREA_SQIN) continue;
      children.push(await createRemnant({ foamId: m.foamId, lengthIn: Math.max(r.w, r.h), widthIn: Math.min(r.w, r.h), source: 'cut', parentId: id, foamOrderId: m.foamOrderId, scheduleNumber: m.scheduleNumber, notes: `Left over from R-${id}` }));
    }
  return { remnant: used, plan, leftovers: children, ordersUpdated: [...byOrder.keys()] };
}
