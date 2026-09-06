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
