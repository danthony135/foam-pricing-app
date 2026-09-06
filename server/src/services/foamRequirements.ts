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
  pieces: { label: string; l: number; w: number; h: number; qty: number; skuCode: string; poly?: [number, number][] }[];
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
      r.pieces.push({ label: `${sku.code} ${p.name}`, l: p.lengthIn, w: p.widthIn, h: p.heightIn, qty, skuCode: sku.code, ...(poly ? { poly } : {}) });
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

export function buildCutPlan(reqs: Requirement[]): Record<number, CutPlan> {
  const plan: Record<number, CutPlan> = {};
  for (const r of reqs) {
    plan[r.foamId] = packPieces(
      r.pieces.map((p) => ({ label: p.label, l: p.l, w: p.w, qty: p.qty, poly: p.poly })),
      r.sheetLengthIn,
      r.sheetWidthIn
    );
  }
  return plan;
}
