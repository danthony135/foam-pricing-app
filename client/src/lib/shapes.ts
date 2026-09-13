/**
 * Preset outlines (inches, y-down, origin top-left) and small polygon helpers
 * shared by the shape editor and the pattern rows.
 */
export type Pt = [number, number];
export type Poly = Pt[];

export interface PresetParam { key: string; label: string; default: number; min?: number; step?: number }
export interface Preset { id: string; name: string; params: PresetParam[]; build: (p: Record<string, number>) => Poly }

const r = (n: number) => Math.round(n * 1000) / 1000;

export const PRESETS: Preset[] = [
  {
    id: 't-cushion',
    name: 'T-cushion',
    params: [
      { key: 'L', label: 'Overall length (front edge)', default: 26 },
      { key: 'W', label: 'Overall depth', default: 24 },
      { key: 'd', label: 'T depth (front ears)', default: 4 },
      { key: 'eL', label: 'Left ear width', default: 3 },
      { key: 'eR', label: 'Right ear width', default: 3 },
    ],
    build: ({ L, W, d, eL, eR }) => [[0, 0], [L, 0], [L, d], [L - eR, d], [L - eR, W], [eL, W], [eL, d], [0, d]],
  },
  {
    id: 'angled-corner',
    name: 'Angled corner (wedge)',
    params: [
      { key: 'L', label: 'Length', default: 30 },
      { key: 'W', label: 'Depth', default: 24 },
      { key: 'a', label: 'Cut-off along length', default: 8 },
      { key: 'b', label: 'Cut-off along depth', default: 8 },
    ],
    build: ({ L, W, a, b }) => [[0, 0], [L - a, 0], [L, b], [L, W], [0, W]],
  },
  {
    id: 'notched-corner',
    name: 'Notched corner',
    params: [
      { key: 'L', label: 'Length', default: 26 },
      { key: 'W', label: 'Depth', default: 24 },
      { key: 'a', label: 'Notch along length', default: 4 },
      { key: 'b', label: 'Notch along depth', default: 4 },
    ],
    build: ({ L, W, a, b }) => [[0, 0], [L - a, 0], [L - a, b], [L, b], [L, W], [0, W]],
  },
  {
    id: 'trapezoid',
    name: 'Trapezoid (wedge seat)',
    params: [
      { key: 'front', label: 'Front width', default: 34 },
      { key: 'back', label: 'Back width', default: 24 },
      { key: 'W', label: 'Depth', default: 24 },
    ],
    build: ({ front, back, W }) => { const off = (front - back) / 2; return [[0, W], [front, W], [front - off, 0], [off, 0]]; },
  },
  {
    id: 'rounded-end',
    name: 'Rounded end (bolster / arm pad)',
    params: [
      { key: 'L', label: 'Length', default: 24 },
      { key: 'W', label: 'Width', default: 8 },
      { key: 'ends', label: 'Rounded ends (1 or 2)', default: 2, min: 1, step: 1 },
    ],
    build: ({ L, W, ends }) => {
      const rr = W / 2, pts: Poly = [];
      const arc = (cx: number, from: number, to: number) => { for (let i = 0; i <= 8; i++) { const a = from + ((to - from) * i) / 8; pts.push([cx + rr * Math.cos(a), rr + rr * Math.sin(a)]); } };
      pts.push([ends >= 2 ? rr : 0, 0]);
      arc(L - rr, -Math.PI / 2, Math.PI / 2); // right end
      if (ends >= 2) arc(rr, Math.PI / 2, (3 * Math.PI) / 2);
      else pts.push([0, W]);
      return pts;
    },
  },
  {
    id: 'l-shape',
    name: 'L-shape (corner seat)',
    params: [
      { key: 'L', label: 'Length', default: 34 },
      { key: 'W', label: 'Depth', default: 34 },
      { key: 'a', label: 'Inner cut along length', default: 12 },
      { key: 'b', label: 'Inner cut along depth', default: 12 },
    ],
    build: ({ L, W, a, b }) => [[0, 0], [L, 0], [L, W - b], [L - a, W - b], [L - a, W], [0, W]],
  },
];

export function area(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
export function bbox(p: Poly) {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
export function normalize(p: Poly): Poly {
  const b = bbox(p);
  return p.map(([x, y]) => [r(x - b.minX), r(y - b.minY)]);
}
export function snap(v: number, step = 0.25) { return r(Math.round(v / step) * step); }

/**
 * Best-fit rectangle of an outline: the minimum-area rectangle around its
 * convex hull (rotating calipers). Tells the real length × width of a slab
 * or remnant no matter how crooked it is lying, plus the angle of its long
 * side and where its origin corner sits. `angleDeg` is measured from the +x
 * axis in a y-down frame, in (-90, 90]; `origin` is the corner where local x
 * and y are both smallest, so `toLocal` is a pure rotation (no mirroring).
 */
export interface FitRect { length: number; width: number; angleDeg: number; origin: Pt; corners: [Pt, Pt, Pt, Pt]; area: number }

export function convexHull(p: Poly): Poly {
  const pts = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Poly = [];
  for (const q of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Poly = [];
  for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export function minAreaRect(p: Poly): FitRect {
  const hull = convexHull(p);
  if (hull.length < 2) { const [x, y] = hull[0] ?? [0, 0]; return { length: 0, width: 0, angleDeg: 0, origin: [x, y], corners: [[x, y], [x, y], [x, y], [x, y]], area: 0 }; }
  // Rectangle around the hull whose x-axis points along angle `a` (radians); v = u rotated +90° in y-down.
  const frame = (a: number): FitRect => {
    const ux = Math.cos(a), uy = Math.sin(a);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const at = (u: number, v: number): Pt => [u * ux - v * uy, u * uy + v * ux];
    const L = maxU - minU, W = maxV - minV;
    return { length: L, width: W, angleDeg: (a * 180) / Math.PI, origin: at(minU, minV), corners: [at(minU, minV), at(maxU, minV), at(maxU, maxV), at(minU, maxV)], area: L * W };
  };
  let best: FitRect | null = null;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = hull[i], [x2, y2] = hull[(i + 1) % n];
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) continue;
    const f = frame(Math.atan2(y2 - y1, x2 - x1));
    if (!best || f.area < best.area - 1e-9) best = f;
  }
  if (!best) best = frame(0);
  // Same rectangle, re-described so the long side is the length and its angle lies in (-90, 90].
  let a = best.angleDeg;
  if (best.width > best.length) a -= 90;
  while (a <= -90) a += 180;
  while (a > 90) a -= 180;
  return a === best.angleDeg ? best : frame((a * Math.PI) / 180);
}

/** Express points in the fitted rectangle's own frame (origin at its first corner, x along its long side). */
export function toLocal(p: Poly, r: FitRect): Poly {
  const a = (r.angleDeg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  return p.map(([x, y]) => { const dx = x - r.origin[0], dy = y - r.origin[1]; return [dx * ux + dy * uy, -dx * uy + dy * ux] as Pt; });
}

/** Douglas-Peucker. */
export function simplify(p: Poly, tol: number): Poly {
  if (p.length < 4) return p;
  const dist = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; if (!l2) return Math.hypot(px - ax, py - ay); const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
  const keep = new Array(p.length).fill(false); keep[0] = keep[p.length - 1] = true;
  const st: [number, number][] = [[0, p.length - 1]];
  while (st.length) { const [a, b] = st.pop()!; let m = 0, idx = -1; for (let i = a + 1; i < b; i++) { const d = dist(p[i], p[a], p[b]); if (d > m) { m = d; idx = i; } } if (m > tol && idx > 0) { keep[idx] = true; st.push([a, idx], [idx, b]); } }
  return p.filter((_, i) => keep[i]);
}

/**
 * Trace the largest dark shape in an image (a cardboard template on a light
 * background, or a white template on a dark floor — auto-picks by which is the
 * minority) and return its outline in pixels using a marching-squares boundary
 * walk. Caller scales pixels → inches with a known reference width.
 */
export function traceImage(img: HTMLImageElement, maxSide = 600): { poly: Poly; w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; gray[i] = g; hist[g]++; }
  // Otsu threshold
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128; const total = w * h;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  let mask = new Uint8Array(w * h);
  let dark = 0; for (let i = 0; i < w * h; i++) { mask[i] = gray[i] < thr ? 1 : 0; dark += mask[i]; }
  if (dark > total / 2) for (let i = 0; i < w * h; i++) mask[i] = 1 - mask[i]; // template is the minority colour
  // Largest connected component (4-neighbour flood fill), ignoring anything touching the border
  const label = new Int32Array(w * h); let next = 1; let bestId = 0, bestN = 0;
  const stack: number[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!mask[s0] || label[s0]) continue;
    const id = next++; let n = 0, touches = false; stack.push(s0); label[s0] = id;
    while (stack.length) { const i = stack.pop()!; n++; const x = i % w, y = (i / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true; for (const j of [i - 1, i + 1, i - w, i + w]) { if (j < 0 || j >= w * h) continue; if (Math.abs((j % w) - x) > 1) continue; if (mask[j] && !label[j]) { label[j] = id; stack.push(j); } } }
    if (!touches && n > bestN) { bestN = n; bestId = id; }
  }
  if (!bestId) throw new Error('No template found — use a plain contrasting background and keep the template fully inside the photo');
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === bestId;
  // Boundary walk (Moore neighbourhood) from the top-most left-most pixel
  let sx = -1, sy = -1;
  for (let i = 0; i < w * h && sx < 0; i++) if (label[i] === bestId) { sx = i % w; sy = (i / w) | 0; }
  const dirs: Pt[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out: Poly = [[sx, sy]];
  let cx = sx, cy = sy, dir = 6; // start looking up-left
  for (let steps = 0; steps < w * h * 2; steps++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8; // start from the direction behind-left of last move
      const nx = cx + dirs[nd][0], ny = cy + dirs[nd][1];
      if (inside(nx, ny)) { cx = nx; cy = ny; dir = nd; found = true; break; }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
    out.push([cx, cy]);
  }
  return { poly: simplify(out, 1.5), w, h };
}
