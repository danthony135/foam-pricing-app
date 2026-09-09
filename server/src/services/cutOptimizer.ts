/**
 * Nest foam pieces (rectangles AND arbitrary outlines) onto stock slabs, one
 * plan per foam. Bottom-left heuristic on a ¼" occupancy grid: pieces largest
 * first, candidate positions = corners of placed pieces + a 2" lattice, four
 * rotations for shapes, exact overlap test on rasterized masks so a piece can
 * tuck into another piece's notch. Every layout it returns is physically valid.
 *
 * The MO on a piece is a label only — packing is decided by size alone, so the
 * fewest slabs win regardless of which orders share a slab.
 *
 * Glue-ups: foam can be glued, so a rectangular piece that would otherwise open
 * a new slab may be split ONCE by a straight cut into two parts that each fit
 * into scrap on existing slabs (same slab or different slabs). Never more than
 * one seam per piece, never a part smaller than MIN_PART_IN, and a whole piece
 * always beats a glued one. A final pass tries to dissolve the last slab into
 * scrap on the earlier ones the same way. Shaped outlines are never glued.
 *
 * Scrap: every slab reports its scrap area and its largest free rectangles
 * (usable remnants), so waste can be tracked per slab type.
 *
 * Remnants: `opts.stockPoly` packs onto an irregular piece of stock (a remnant
 * outline) instead of a full rectangular slab — cells outside the outline are
 * blocked before nesting — and `opts.maxSheets` caps how many sheets may be
 * opened (1 for "what fits on this remnant"); the rest come back as unplaced.
 */
import { area, bbox, isValid, normalize, rasterize, rectPoly, rotate, round, translate, type Poly } from './geometry';

export interface CutPiece {
  label: string; // "400-30 Seat core"
  l: number;
  w: number;
  qty: number;
  poly?: Poly; // shaped outline (inches, y-down); omitted = rectangle l × w
  mo?: string; // production order this piece belongs to (schedule / MO orders)
  noGlue?: boolean; // this piece must be cut whole
}
export interface Glue {
  group: string; // shared by the two parts
  part: 'A' | 'B';
  seam: [number, number, number, number]; // seam segment in sheet coords (x1,y1,x2,y2)
  mateSlab?: number; // sheet index holding the other part
  wholeL: number;
  wholeW: number;
}
export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number; // placed bbox width (x)
  h: number; // placed bbox height (y)
  rotated: boolean;
  rot: number;
  poly?: Poly; // placed outline in sheet coordinates (shaped pieces and glue parts)
  mo?: string;
  glue?: Glue;
}
export interface Remnant { x: number; y: number; w: number; h: number }
export interface Sheet {
  index: number;
  pieces: PlacedPiece[];
  usedArea: number;
  utilization: number;
  scrapSqIn: number;
  remnants: Remnant[]; // largest free rectangles, biggest first
}
export interface CutPlan {
  sheetLength: number;
  sheetWidth: number;
  sheets: Sheet[];
  pieceCount: number;
  gluedPieces: number; // pieces that were split into two glued parts
  unplaced: { label: string; l: number; w: number }[];
  utilization: number;
  scrapSqIn: number;
}

const RES = 0.25; // inches per grid cell
const PAD = 1; // cells of dilation (¼" kerf / template slop)
const MIN_PART_IN = 4; // smallest glue part
const MIN_REMNANT_IN = 6; // smallest free rectangle worth reporting
// Split positions tried, as a fraction of the cut dimension — middle first (a
// centred seam is strongest and easiest to glue square).
const SPLIT_FRACTIONS = [0.5, 0.4, 0.6, 0.33, 0.67, 0.25, 0.75];

interface Item {
  id: number;
  label: string;
  mo?: string;
  poly: Poly; // normalized, rotation 0
  area: number;
  shaped: boolean;
  glueOk: boolean;
  glue?: { group: string; part: 'A' | 'B'; seamEdge: number; wholeL: number; wholeW: number };
}
interface Variant {
  rot: number;
  poly: Poly;
  mask: ReturnType<typeof rasterize>; // dilated by PAD: used to TEST a placement (keeps the kerf gap)
  body: ReturnType<typeof rasterize>; // undilated: what gets MARKED once placed
  isBody: Uint8Array; // per mask cell: 1 = part of the piece itself, 0 = kerf ring
  w: number;
  h: number;
}
interface Placement { v: Variant; cx: number; cy: number; score: number }

class SheetGrid {
  grid: Uint8Array;
  gw: number;
  gh: number;
  xs = new Set<number>([0]);
  ys = new Set<number>([0]);
  blocked = 0; // cells outside the stock outline
  constructor(public L: number, public W: number, stock?: Poly) {
    this.gw = Math.ceil(L / RES);
    this.gh = Math.ceil(W / RES);
    this.grid = new Uint8Array(this.gw * this.gh);
    if (stock) {
      // Block everything outside the outline with value 2: a piece's body may not
      // cover it, but its kerf ring may (like the ring hanging off a slab edge),
      // so pieces can sit right on the remnant's edge.
      const body = rasterize(normalize(stock), RES, 0);
      const inside = new Uint8Array(body.w * body.h);
      for (let i = 0; i < body.cells.length; i++) inside[body.cells[i]] = 1;
      const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < body.w && y < body.h && inside[y * body.w + x] === 1;
      for (let y = 0; y < this.gh; y++)
        for (let x = 0; x < this.gw; x++) {
          if (!ok(x, y)) { this.grid[y * this.gw + x] = 2; this.blocked++; }
        }
      // Candidate rows/cols along the outline's vertices help pieces hug angled edges.
      for (const [px, py] of normalize(stock)) { this.xs.add(Math.ceil(px / RES)); this.ys.add(Math.ceil(py / RES)); }
    }
  }
  fits(v: Variant, cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0) return false;
    if (cx * RES + v.w > this.L + 1e-6 || cy * RES + v.h > this.W + 1e-6) return false;
    const { w, cells } = v.mask;
    const ox = cx - PAD, oy = cy - PAD;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const px = ox + (c % w), py = oy + Math.floor(c / w);
      if (px < 0 || py < 0 || px >= this.gw || py >= this.gh) continue; // ring may hang off the slab edge
      const g = this.grid[py * this.gw + px];
      if (g === 1 || (g === 2 && v.isBody[c])) return false; // ring may overlap the stock boundary, body may not
    }
    return true;
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
  snapshot() {
    return { grid: new Uint8Array(this.grid), xs: new Set(this.xs), ys: new Set(this.ys) };
  }
  restore(s: ReturnType<SheetGrid['snapshot']>) {
    this.grid.set(s.grid);
    this.xs = new Set(s.xs);
    this.ys = new Set(s.ys);
  }
  /** Largest empty rectangles (histogram method per row), greedy non-overlapping, biggest first. */
  remnants(max = 3): Remnant[] {
    const out: Remnant[] = [];
    const taken = new Uint8Array(this.grid); // free cells already claimed by a reported remnant
    for (let k = 0; k < max; k++) {
      let best: Remnant | null = null;
      let bestA = 0;
      const heights = new Int32Array(this.gw);
      for (let y = 0; y < this.gh; y++) {
        for (let x = 0; x < this.gw; x++) heights[x] = taken[y * this.gw + x] ? 0 : heights[x] + 1;
        // Largest rectangle in histogram
        const stack: number[] = [];
        for (let x = 0; x <= this.gw; x++) {
          const h = x < this.gw ? heights[x] : 0;
          while (stack.length && heights[stack[stack.length - 1]] >= h) {
            const top = stack.pop()!;
            const hh = heights[top];
            const left = stack.length ? stack[stack.length - 1] + 1 : 0;
            const ww = x - left;
            const a = hh * ww;
            if (a > bestA && hh * RES >= MIN_REMNANT_IN && ww * RES >= MIN_REMNANT_IN) {
              bestA = a;
              best = { x: left, y: y - hh + 1, w: ww, h: hh };
            }
          }
          stack.push(x);
        }
      }
      if (!best) break;
      for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) taken[y * this.gw + x] = 1;
      out.push({ x: round(best.x * RES, 2), y: round(best.y * RES, 2), w: round(best.w * RES, 2), h: round(best.h * RES, 2) });
    }
    return out;
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
    const mask = rasterize(poly, RES, PAD);
    const bodyInFrame = rasterize(poly, RES, PAD, false);
    const isBody = new Uint8Array(mask.w * mask.h);
    for (let i = 0; i < bodyInFrame.cells.length; i++) isBody[bodyInFrame.cells[i]] = 1;
    out.push({ rot, poly, mask, body: rasterize(poly, RES, 0), isBody, w: b.w, h: b.h });
  }
  return out;
}

export interface PackOptions {
  glue?: boolean;
  stockPoly?: Poly; // irregular stock outline (inches, y-down); sheetLength/Width should be its bbox
  maxSheets?: number; // cap on sheets opened (default unlimited)
}

export function packPieces(pieces: CutPiece[], sheetLength: number, sheetWidth: number, opts: PackOptions = {}): CutPlan {
  const allowGlue = opts.glue !== false;
  const stock = isValid(opts.stockPoly) ? normalize(opts.stockPoly as Poly) : undefined;
  const maxSheets = opts.maxSheets ?? Infinity;
  let nextId = 1;
  const items: Item[] = [];
  for (const p of pieces) {
    const shaped = isValid(p.poly);
    const poly = shaped ? normalize(p.poly as Poly) : rectPoly(p.l, p.w);
    for (let i = 0; i < Math.max(1, Math.round(p.qty)); i++) {
      items.push({ id: nextId++, label: p.label, mo: p.mo, poly, area: area(poly), shaped, glueOk: allowGlue && !shaped && !p.noGlue });
    }
  }
  items.sort((a, b) => b.area - a.area || Math.max(bbox(b.poly).w, bbox(b.poly).h) - Math.max(bbox(a.poly).w, bbox(a.poly).h));

  const varCache = new Map<Item, Variant[]>();
  const vars = (it: Item) => varCache.get(it) ?? (varCache.set(it, variants(it)), varCache.get(it)!);

  const sheets: Sheet[] = [];
  const grids: SheetGrid[] = [];
  const unplaced: { label: string; l: number; w: number }[] = [];
  let gluedPieces = 0;

  /** Best bottom-left placement on one slab, or null. Does not mutate. */
  const findPlacement = (g: SheetGrid, it: Item): Placement | null => {
    const step = Math.round(2 / RES);
    const xs = new Set(g.xs), ys = new Set(g.ys);
    for (let cx = 0; cx * RES <= g.L; cx += step) xs.add(cx);
    for (let cy = 0; cy * RES <= g.W; cy += step) ys.add(cy);
    const xl = [...xs].sort((a, b) => a - b), yl = [...ys].sort((a, b) => a - b);
    let best: Placement | null = null;
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
    return best;
  };

  const commit = (g: SheetGrid, sheet: Sheet, it: Item, pl: Placement): PlacedPiece => {
    g.place(pl.v, pl.cx, pl.cy);
    const x = round(pl.cx * RES, 2), y = round(pl.cy * RES, 2);
    const placedPoly = translate(pl.v.poly, x, y);
    const piece: PlacedPiece = {
      label: it.label,
      x, y,
      w: round(pl.v.w, 2),
      h: round(pl.v.h, 2),
      rotated: pl.v.rot !== 0,
      rot: pl.v.rot,
      ...(it.shaped ? { poly: placedPoly } : {}),
      ...(it.mo ? { mo: it.mo } : {}),
    };
    if (it.glue) {
      const k = it.glue.seamEdge;
      const a = placedPoly[k], b = placedPoly[(k + 1) % placedPoly.length];
      piece.glue = { group: it.glue.group, part: it.glue.part, seam: [a[0], a[1], b[0], b[1]], wholeL: it.glue.wholeL, wholeW: it.glue.wholeW };
      piece.poly = placedPoly;
    }
    sheet.pieces.push(piece);
    sheet.usedArea += it.area;
    return piece;
  };

  /** Place whole on the first slab (in `range`) with room. */
  const placeWhole = (it: Item, range: number[]): { sheet: Sheet; piece: PlacedPiece } | null => {
    for (const i of range) {
      const pl = findPlacement(grids[i], it);
      if (pl) return { sheet: sheets[i], piece: commit(grids[i], sheets[i], it, pl) };
    }
    return null;
  };

  /** Two rectangular parts from one straight cut; seamEdge = index of the edge along the cut. */
  const splitOptions = (it: Item): [Item, Item][] => {
    const b = bbox(it.poly);
    const out: [Item, Item][] = [];
    const group = `g${it.id}`;
    const mk = (poly: Poly, part: 'A' | 'B', seamEdge: number): Item => ({ ...it, id: nextId++, poly, area: area(poly), shaped: true, glueOk: false, glue: { group, part, seamEdge, wholeL: b.w, wholeW: b.h } });
    for (const frac of SPLIT_FRACTIONS) {
      // Cut across the length (vertical seam): A = left part (seam = right edge 1→2), B = right part (seam = left edge 3→0).
      const sL = round(Math.round((b.w * frac) / 0.25) * 0.25, 2);
      if (sL >= MIN_PART_IN && b.w - sL >= MIN_PART_IN) out.push([mk(rectPoly(sL, b.h), 'A', 1), mk(rectPoly(b.w - sL, b.h), 'B', 3)]);
      // Cut across the width (horizontal seam): A = top part (seam = bottom edge 2→3), B = bottom part (seam = top edge 0→1).
      const sW = round(Math.round((b.h * frac) / 0.25) * 0.25, 2);
      if (sW >= MIN_PART_IN && b.h - sW >= MIN_PART_IN) out.push([mk(rectPoly(b.w, sW), 'A', 2), mk(rectPoly(b.w, b.h - sW), 'B', 0)]);
    }
    return out;
  };

  const snapshotAll = (range: number[]) => range.map((i) => [i, grids[i].snapshot(), sheets[i].pieces.length, sheets[i].usedArea] as const);
  const restoreAll = (snaps: ReturnType<typeof snapshotAll>) => {
    for (const [i, snap, n, used] of snaps) {
      grids[i].restore(snap);
      sheets[i].pieces.length = n;
      sheets[i].usedArea = used;
    }
  };

  /** Try to fit `it` as two glued parts into existing scrap in `range`. Rolls back on failure. */
  const placeSplit = (it: Item, range: number[]): boolean => {
    if (!it.glueOk || !range.length) return false;
    for (const [A, B] of splitOptions(it)) {
      const snaps = snapshotAll(range);
      const ra = placeWhole(A, range);
      const rb = ra ? placeWhole(B, range) : null;
      if (ra && rb) {
        ra.piece.glue!.mateSlab = rb.sheet.index;
        rb.piece.glue!.mateSlab = ra.sheet.index;
        gluedPieces++;
        return true;
      }
      restoreAll(snaps);
    }
    return false;
  };

  const openSheet = () => {
    sheets.push({ index: sheets.length + 1, pieces: [], usedArea: 0, utilization: 0, scrapSqIn: 0, remnants: [] });
    grids.push(new SheetGrid(sheetLength, sheetWidth, stock));
    return sheets.length - 1;
  };
  const allRange = () => sheets.map((_, i) => i);

  for (const it of items) {
    const b = bbox(it.poly);
    const fail = () => unplaced.push({ label: it.label, l: round(b.w, 2), w: round(b.h, 2) });
    if (!((b.w <= sheetLength && b.h <= sheetWidth) || (b.h <= sheetLength && b.w <= sheetWidth))) {
      // Too big for a slab even whole — a glue-up is its only chance.
      if (!placeSplit(it, allRange())) {
        if (sheets.length >= maxSheets) { fail(); continue; }
        openSheet();
        if (!placeSplit(it, allRange())) { sheets.pop(); grids.pop(); fail(); }
      }
      continue;
    }
    if (placeWhole(it, allRange())) continue;
    if (placeSplit(it, allRange())) continue;
    if (sheets.length >= maxSheets) { fail(); continue; }
    const i = openSheet();
    if (!placeWhole(it, [i])) fail();
  }

  // Dissolve the last slab into scrap on the earlier ones (whole first, then one glue seam).
  while (sheets.length > 1) {
    const last = sheets.length - 1;
    const range = sheets.slice(0, last).map((_, i) => i);
    if (sheets[last].pieces.some((p) => p.glue)) break; // glue parts stay where their mate expects them
    const snaps = snapshotAll(range);
    const before = gluedPieces;
    const ok = sheets[last].pieces.every((p) => {
      const poly = p.poly ? normalize(rotate(p.poly, (360 - p.rot) % 360)) : rectPoly(p.rotated ? p.h : p.w, p.rotated ? p.w : p.h);
      const it: Item = { id: nextId++, label: p.label, mo: p.mo, poly, area: area(poly), shaped: !!p.poly, glueOk: allowGlue && !p.poly };
      return !!placeWhole(it, range) || placeSplit(it, range);
    });
    if (ok) {
      sheets.pop();
      grids.pop();
      continue;
    }
    gluedPieces = before;
    restoreAll(snaps);
    break;
  }

  // Usable stock area: the whole rectangle, or the remnant outline's area.
  const sheetArea = stock ? area(stock) : sheetLength * sheetWidth;
  let scrapTotal = 0;
  sheets.forEach((s, i) => {
    s.utilization = sheetArea ? s.usedArea / sheetArea : 0;
    s.scrapSqIn = round(Math.max(0, sheetArea - s.usedArea), 1);
    s.remnants = grids[i].remnants(3);
    scrapTotal += s.scrapSqIn;
  });
  const totalUsed = sheets.reduce((a, s) => a + s.usedArea, 0);
  const placedCount = sheets.reduce((a, s) => a + s.pieces.filter((p) => !p.glue || p.glue.part === 'A').length, 0);
  return {
    sheetLength,
    sheetWidth,
    sheets,
    pieceCount: placedCount,
    gluedPieces,
    unplaced,
    utilization: sheets.length ? totalUsed / (sheets.length * sheetArea) : 0,
    scrapSqIn: round(scrapTotal, 1),
  };
}
