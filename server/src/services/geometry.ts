/**
 * Polygon helpers for shaped foam pieces. Coordinates are inches, y-down
 * (screen-style), which is also how the SVG draws them.
 */
export type Pt = [number, number];
export type Poly = Pt[];

export function rectPoly(l: number, w: number): Poly {
  return [[0, 0], [l, 0], [l, w], [0, w]];
}

/** Shoelace area (absolute). */
export function area(p: Poly): number {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function bbox(p: Poly): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Translate so the bbox min corner sits at (0,0). */
export function normalize(p: Poly): Poly {
  const b = bbox(p);
  return p.map(([x, y]) => [round(x - b.minX), round(y - b.minY)]);
}

export function rotate(p: Poly, deg: number): Poly {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return normalize(p.map(([x, y]) => [x * c - y * s, x * s + y * c]));
}

export function translate(p: Poly, dx: number, dy: number): Poly {
  return p.map(([x, y]) => [round(x + dx), round(y + dy)]);
}

export function centroid(p: Poly): Pt {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const b = bbox(p);
    return [b.minX + b.w / 2, b.minY + b.h / 2];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function round(n: number, d = 3): number {
  const m = 10 ** d;
  return Math.round(n * m) / m;
}

/** Douglas-Peucker simplification (tolerance in inches). */
export function simplify(p: Poly, tol = 0.05): Poly {
  if (p.length < 4) return p;
  const keep = new Array(p.length).fill(false);
  keep[0] = keep[p.length - 1] = true;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = pointLineDist(p[i], p[a], p[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = p.filter((_, i) => keep[i]);
  // Closing duplicate
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}

function pointLineDist([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Is the polygon usable? ≥3 points, non-trivial area. */
export function isValid(p: unknown): p is Poly {
  return Array.isArray(p) && p.length >= 3 && p.every((q) => Array.isArray(q) && q.length === 2 && Number.isFinite(q[0]) && Number.isFinite(q[1])) && area(p as Poly) > 0.5;
}

// ---------------------------------------------------------------------------
// Rasterization (for the shape nester). Grid cell = `res` inches.
// ---------------------------------------------------------------------------
export interface Mask {
  w: number; // cells
  h: number;
  cells: Int32Array; // packed (y*w+x) of filled cells
}

/**
 * Scanline-fill a polygon into a cell mask, then dilate by `pad` cells (kerf /
 * template slop). `dilate = false` keeps the padded frame but skips the
 * dilation, so body and ring can be told apart in the same coordinates.
 */
export function rasterize(p: Poly, res: number, pad = 1, dilate = true): Mask {
  const b = bbox(p);
  const w = Math.ceil(b.w / res) + pad * 2 + 1;
  const h = Math.ceil(b.h / res) + pad * 2 + 1;
  const grid = new Uint8Array(w * h);
  const n = p.length;
  for (let cy = 0; cy < h; cy++) {
    const y = b.minY + (cy - pad + 0.5) * res;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % n];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, c) => a - c);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.floor((xs[k] - b.minX) / res) + pad);
      const x1 = Math.min(w - 1, Math.ceil((xs[k + 1] - b.minX) / res) + pad - 1);
      for (let cx = x0; cx <= x1; cx++) grid[cy * w + cx] = 1;
    }
  }
  if (pad > 0 && dilate) {
    const d = new Uint8Array(grid);
    for (let cy = 0; cy < h; cy++)
      for (let cx = 0; cx < w; cx++) {
        if (!grid[cy * w + cx]) continue;
        for (let dy = -pad; dy <= pad; dy++)
          for (let dx = -pad; dx <= pad; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) d[ny * w + nx] = 1;
          }
      }
    grid.set(d);
  }
  const cells: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i]) cells.push(i);
  return { w, h, cells: Int32Array.from(cells) };
}
