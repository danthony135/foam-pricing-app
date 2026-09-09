/**
 * Turn a foam order's SKU × qty lines into per-foam requirements (pieces,
 * board feet with waste, on-hand, shortfall) and a cut plan per foam.
 */
import { prisma } from '../index';
import { packPieces, type CutPlan } from './cutOptimizer';
import { getSetting, DEFAULT_WASTE_PCT, round2 } from './odooSync';

export interface OrderLine {
  skuId: number;
  code: string;
  name: string;
  qty: number;
  moId?: number;
  moName?: string;
}

export interface Requirement {
  foamId: number;
  grade: string;
  thicknessIn: number | null;
  odooProductId: number | null;
  pieces: { label: string; l: number; w: number; h: number; qty: number; skuCode: string; poly?: [number, number][]; mo?: string }[];
  pieceCount: number;
  netBoardFeet: number;
  boardFeet: number;
  onHand: number;
  shortfall: number;
  costPerBoardFoot: number;
  cost: number;
  sheetLengthIn: number;
  sheetWidthIn: number;
  missingPatterns: string[];
}

export async function buildRequirements(lines: OrderLine[]): Promise<Requirement[]> {
  const wastePct = await getSetting<number>('foam.wastePct', DEFAULT_WASTE_PCT);
  const skus = await prisma.sku.findMany({ where: { id: { in: lines.map((l) => l.skuId) } }, include: { pieces: { include: { foam: { include: { inventory: true } } } } } });
  const skuById = new Map(skus.map((s) => [s.id, s]));
  const byFoam = new Map<number, Requirement>();
  const missing = new Set<string>();
  for (const line of lines) {
    const sku = skuById.get(line.skuId);
    if (!sku) continue;
    if (!sku.pieces.length) missing.add(sku.code);
    for (const p of sku.pieces) {
      if (!p.foam) continue;
      const f = p.foam;
      const r = byFoam.get(f.id) ?? {
        foamId: f.id,
        grade: f.grade,
        thicknessIn: f.thicknessIn,
        odooProductId: f.odooProductId,
        pieces: [],
        pieceCount: 0,
        netBoardFeet: 0,
        boardFeet: 0,
        onHand: f.inventory?.boardFeetOnHand ?? 0,
        shortfall: 0,
        costPerBoardFoot: f.costPerBoardFoot,
        cost: 0,
        sheetLengthIn: f.sheetLengthIn,
        sheetWidthIn: f.sheetWidthIn,
        missingPatterns: [],
      };
      const qty = p.qty * line.qty;
      const poly = p.shapeType === 'polygon' && Array.isArray(p.shape) ? (p.shape as [number, number][]) : undefined;
      const sqIn = poly && p.areaSqIn ? p.areaSqIn : p.lengthIn * p.widthIn;
      // One entry per production order so the slab picture can carry the MO number.
      r.pieces.push({ label: `${sku.code} ${p.name}`, l: p.lengthIn, w: p.widthIn, h: p.heightIn, qty, skuCode: sku.code, ...(poly ? { poly } : {}), ...(line.moName ? { mo: line.moName } : {}) });
      r.pieceCount += qty;
      r.netBoardFeet += (sqIn * p.heightIn / 144) * qty;
      byFoam.set(f.id, r);
    }
  }
  const out = [...byFoam.values()].map((r) => {
    r.netBoardFeet = round2(r.netBoardFeet);
    r.boardFeet = round2(r.netBoardFeet * (1 + wastePct / 100));
    r.shortfall = round2(Math.max(0, r.boardFeet - r.onHand));
    r.cost = round2(r.boardFeet * r.costPerBoardFoot);
    r.missingPatterns = [...missing];
    return r;
  });
  out.sort((a, b) => (b.thicknessIn ?? 0) - (a.thicknessIn ?? 0));
  return out;
}

/** A piece (or several of one kind) that was cut from a remnant instead of a slab. */
export interface RemnantCut {
  label: string;
  mo?: string;
  qty: number;
  remnantId: number;
  at: string;
}

/**
 * Nest each foam's pieces onto slabs. Pieces already cut from remnants are
 * taken out first (matched by label + MO) so the slab plan only shows what is
 * still to be cut from full stock.
 */
export function buildCutPlan(reqs: Requirement[], remnantCuts: RemnantCut[] = []): Record<number, CutPlan> {
  const plan: Record<number, CutPlan> = {};
  const left = new Map<string, number>();
  for (const c of remnantCuts) { const k = `${c.label}|${c.mo ?? ''}`; left.set(k, (left.get(k) ?? 0) + c.qty); }
  for (const r of reqs) {
    const pieces = r.pieces
      .map((p) => {
        const k = `${p.label}|${p.mo ?? ''}`;
        const take = Math.min(p.qty, left.get(k) ?? 0);
        if (take) left.set(k, (left.get(k) ?? 0) - take);
        return { label: p.label, l: p.l, w: p.w, qty: p.qty - take, poly: p.poly, mo: p.mo };
      })
      .filter((p) => p.qty > 0);
    plan[r.foamId] = packPieces(pieces, r.sheetLengthIn, r.sheetWidthIn);
  }
  return plan;
}
