/**
 * Nest foam pieces (rectangles AND arbitrary outlines) onto stock slabs, one
 * plan per foam. Bottom-left heuristic on a ¼" occupancy grid: pieces largest
 * first, candidate positions come from the corners of what is already placed,
 * four rotations tried, exact overlap test on rasterized masks so a piece can
 * tuck into another piece's notch. Not optimal, but honest and fast enough for
 * a shop cut list (tens of pieces per slab), and every layout it returns is
 * physically valid.
 */
import { area, bbox, isValid, normalize, rasterize, rectPoly, rotate, round, translate, type Poly } from './geometry';

export interface CutPiece {
  label: string; // "400-30 Seat core"
  l: number;
  w: number;
  qty: number;
  poly?: Poly; // shaped outline (inches, y-down); omitted = rectangle l × w
  mo?: string; // production order this piece belongs to (schedule / MO orders)
}
export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number; // placed bbox width (x)
  h: number; // placed bbox height (y)
  rotated: boolean; // any rotation ≠ 0
  rot: number; // degrees
  poly?: Poly; // placed outline in sheet coordinates (only for shaped pieces)
  mo?: string;
}
export interface Sheet {
  index: number;
  pieces: PlacedPiece[];
  usedArea: number;
  utilization: number;
}
export interface CutPlan {
  sheetLength: number;
  sheetWidth: number;
  sheets: Sheet[];
  pieceCount: number;
  unplaced: { label: string; l: number; w: number }[];
  utilization: number;
}

const RES = 0.25; // inches per grid cell
const PAD = 1; // cells of dilation (¼" kerf / template slop)

interface Item {
  label: string;
  mo?: string;
  poly: Poly; // normalized, rotation 0
  area: number;
  shaped: boolean;
}
interface Variant {
  rot: number;
  poly: Poly;
  mask: ReturnType<typeof rasterize>; // dilated by PAD: used to TEST a placement (keeps the kerf gap)
  body: ReturnType<typeof rasterize>; // undilated: what gets MARKED once placed
  w: number; // inches
  h: number;
}

class SheetGrid {
  grid: Uint8Array;
  gw: number;
  gh: number;
  xs = new Set<number>([0]); // candidate x positions (cells)
  ys = new Set<number>([0]);
  constructor(public L: number, public W: number) {
    this.gw = Math.ceil(L / RES);
    this.gh = Math.ceil(W / RES);
    this.grid = new Uint8Array(this.gw * this.gh);
  }
  fits(v: Variant, cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx + v.mask.w - PAD * 2 > this.gw + 1 || cy + v.mask.h - PAD * 2 > this.gh + 1) return false;
    const { w, cells } = v.mask;
    const ox = cx - PAD, oy = cy - PAD;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const px = ox + (c % w), py = oy + Math.floor(c / w);
      if (px < 0 || py < 0 || px >= this.gw || py >= this.gh) {
        // Dilation ring may hang past the slab edge — only the real body must be inside.
        continue;
      }
      if (this.grid[py * this.gw + px]) return false;
    }
    // Body must be inside the slab: check bbox in inches.
    return cx * RES + v.w <= this.L + 1e-6 && cy * RES + v.h <= this.W + 1e-6;
  }
  place(v: Variant, cx: number, cy: number) {
    const { w, cells } = v.body;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const px = cx + (c % w), py = cy + Math.floor(c / w);
      if (px >= 0 && py >= 0 && px < this.gw && py < this.gh) this.grid[py * this.gw + px] = 1;
    }
    this.xs.add(cx + Math.ceil(v.w / RES) + PAD);
    this.ys.add(cy + Math.ceil(v.h / RES) + PAD);
    this.xs.add(cx);
    this.ys.add(cy);
  }
}

function variants(it: Item): Variant[] {
  const rots = it.shaped ? [0, 90, 180, 270] : [0, 90];
  const out: Variant[] = [];
  const seen = new Set<string>();
  for (const rot of rots) {
    const poly = rot ? rotate(it.poly, rot) : it.poly;
    const b = bbox(poly);
    const key = `${round(b.w, 2)}x${round(b.h, 2)}:${rot % 180}`;
    if (!it.shaped && seen.has(key)) continue;
    seen.add(key);
    out.push({ rot, poly, mask: rasterize(poly, RES, PAD), body: rasterize(poly, RES, 0), w: b.w, h: b.h });
  }
  return out;
}

export function packPieces(pieces: CutPiece[], sheetLength: number, sheetWidth: number): CutPlan {
  const items: Item[] = [];
  for (const p of pieces) {
    const shaped = isValid(p.poly);
    const poly = shaped ? normalize(p.poly as Poly) : rectPoly(p.l, p.w);
    const it: Item = { label: p.label, mo: p.mo, poly, area: area(poly), shaped };
    for (let i = 0; i < Math.max(1, Math.round(p.qty)); i++) items.push(it);
  }
  items.sort((a, b) => b.area - a.area || Math.max(bbox(b.poly).w, bbox(b.poly).h) - Math.max(bbox(a.poly).w, bbox(a.poly).h));

  const varCache = new Map<Item, Variant[]>();
  const vars = (it: Item) => varCache.get(it) ?? (varCache.set(it, variants(it)), varCache.get(it)!);

  const sheets: Sheet[] = [];
  const grids: SheetGrid[] = [];
  const unplaced: { label: string; l: number; w: number }[] = [];

  const tryPlace = (g: SheetGrid, sheet: Sheet, it: Item): boolean => {
    // Candidate positions: corners of placed pieces (exact) plus a 2" lattice so a
    // piece can interlock (a T-cushion ear into the next one's notch). Sorted
    // bottom-left, first fit wins; fits() exits at the first colliding cell so the
    // many positions that land inside placed pieces are cheap.
    const step = Math.round(2 / RES);
    const xs = new Set(g.xs), ys = new Set(g.ys);
    for (let cx = 0; cx * RES <= g.L; cx += step) xs.add(cx);
    for (let cy = 0; cy * RES <= g.W; cy += step) ys.add(cy);
    const xl = [...xs].sort((a, b) => a - b), yl = [...ys].sort((a, b) => a - b);
    let best: { v: Variant; cx: number; cy: number; score: number } | null = null;
    for (const v of vars(it)) {
      if (v.w > g.L + 1e-6 || v.h > g.W + 1e-6) continue;
      let done = false;
      for (const cy of yl) {
        if (done || cy * RES + v.h > g.W + 1e-6) break;
        for (const cx of xl) {
          if (cx * RES + v.w > g.L + 1e-6) break;
          const score = cy * 100000 + cx;
          if (best && score >= best.score) { done = true; break; }
          if (g.fits(v, cx, cy)) { best = { v, cx, cy, score }; done = true; break; }
        }
      }
    }
    if (!best) return false;
    g.place(best.v, best.cx, best.cy);
    const x = round(best.cx * RES, 2), y = round(best.cy * RES, 2);
    sheet.pieces.push({
      label: it.label,
      x, y,
      w: round(best.v.w, 2),
      h: round(best.v.h, 2),
      rotated: best.v.rot !== 0,
      rot: best.v.rot,
      ...(it.shaped ? { poly: translate(best.v.poly, x, y) } : {}),
      ...(it.mo ? { mo: it.mo } : {}),
    });
    sheet.usedArea += it.area;
    return true;
  };

  for (const it of items) {
    const b = bbox(it.poly);
    if (!((b.w <= sheetLength && b.h <= sheetWidth) || (b.h <= sheetLength && b.w <= sheetWidth))) {
      unplaced.push({ label: it.label, l: round(b.w, 2), w: round(b.h, 2) });
      continue;
    }
    let placed = false;
    for (let i = 0; i < sheets.length && !placed; i++) placed = tryPlace(grids[i], sheets[i], it);
    if (!placed) {
      const sheet: Sheet = { index: sheets.length + 1, pieces: [], usedArea: 0, utilization: 0 };
      const g = new SheetGrid(sheetLength, sheetWidth);
      sheets.push(sheet);
      grids.push(g);
      if (!tryPlace(g, sheet, it)) unplaced.push({ label: it.label, l: round(b.w, 2), w: round(b.h, 2) });
    }
  }
  const sheetArea = sheetLength * sheetWidth;
  for (const s of sheets) s.utilization = sheetArea ? s.usedArea / sheetArea : 0;
  const totalUsed = sheets.reduce((a, s) => a + s.usedArea, 0);
  return {
    sheetLength,
    sheetWidth,
    sheets,
    pieceCount: items.length - unplaced.length,
    unplaced,
    utilization: sheets.length ? totalUsed / (sheets.length * sheetArea) : 0,
  };
}
