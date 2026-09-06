/**
 * Minimal DXF outline reader: LWPOLYLINE / POLYLINE (with bulge arcs), LINE
 * chains, ARC, CIRCLE, SPLINE control points. Returns the largest closed
 * outline as a polygon in inches, y-down (DXF is y-up, so y is flipped).
 * Units: $INSUNITS 4 = mm → converted; anything else treated as inches.
 */
import { area, normalize, simplify, type Poly, type Pt } from './geometry';

interface Entity {
  type: string;
  pts: Pt[];
  bulges: number[];
  closed: boolean;
  cx?: number;
  cy?: number;
  r?: number;
  a0?: number;
  a1?: number;
}

function pairs(text: string): [string, string][] {
  const lines = text.split(/\r?\n/);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([lines[i].trim(), lines[i + 1].trim()]);
  return out;
}

export function parseDxf(text: string): { poly: Poly; units: string; entities: number } {
  const ps = pairs(text);
  let units = 'in';
  let scale = 1;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === '9' && ps[i][1] === '$INSUNITS' && ps[i + 1]?.[0] === '70') {
      if (ps[i + 1][1] === '4') { units = 'mm'; scale = 1 / 25.4; }
      if (ps[i + 1][1] === '5') { units = 'cm'; scale = 1 / 2.54; }
      break;
    }
  }
  const ents: Entity[] = [];
  let cur: Entity | null = null;
  let px: number | null = null;
  let lastBulge = 0;
  let inEntities = false;
  const flush = () => { if (cur && (cur.pts.length || cur.type === 'CIRCLE' || cur.type === 'ARC')) ents.push(cur); cur = null; };
  for (let i = 0; i < ps.length; i++) {
    const [code, val] = ps[i];
    if (code === '2' && val === 'ENTITIES') inEntities = true;
    if (!inEntities) continue;
    if (code === '0') {
      flush();
      if (['LWPOLYLINE', 'POLYLINE', 'LINE', 'ARC', 'CIRCLE', 'SPLINE'].includes(val)) cur = { type: val, pts: [], bulges: [], closed: false };
      else if (val === 'VERTEX' && ents.length && ents[ents.length - 1].type === 'POLYLINE') cur = ents.pop()!;
      else if (val === 'SEQEND') { /* polyline ends */ }
      else if (val === 'ENDSEC') break;
      px = null;
      continue;
    }
    if (!cur) continue;
    const v = parseFloat(val);
    switch (cur.type) {
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (code === '70') cur.closed = (parseInt(val) & 1) === 1;
        if (code === '10') { px = v; lastBulge = 0; }
        if (code === '20' && px !== null) { cur.pts.push([px, v]); cur.bulges.push(0); px = null; }
        if (code === '42') cur.bulges[cur.bulges.length - 1] = v;
        break;
      case 'LINE':
        if (code === '10') px = v;
        if (code === '20' && px !== null) { cur.pts[0] = [px, v]; px = null; }
        if (code === '11') px = v;
        if (code === '21' && px !== null) { cur.pts[1] = [px, v]; px = null; }
        break;
      case 'ARC':
      case 'CIRCLE':
        if (code === '10') cur.cx = v;
        if (code === '20') cur.cy = v;
        if (code === '40') cur.r = v;
        if (code === '50') cur.a0 = v;
        if (code === '51') cur.a1 = v;
        break;
      case 'SPLINE':
        if (code === '10') px = v;
        if (code === '20' && px !== null) { cur.pts.push([px, v]); cur.bulges.push(0); px = null; }
        if (code === '70') cur.closed = (parseInt(val) & 1) === 1;
        break;
    }
  }
  flush();

  // Expand each entity to a polyline of points.
  const polylines: { pts: Pt[]; closed: boolean }[] = [];
  for (const e of ents) {
    if (e.type === 'CIRCLE' && e.r) {
      polylines.push({ pts: arcPts(e.cx!, e.cy!, e.r, 0, 360), closed: true });
    } else if (e.type === 'ARC' && e.r) {
      polylines.push({ pts: arcPts(e.cx!, e.cy!, e.r, e.a0 ?? 0, e.a1 ?? 360), closed: false });
    } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.pts.length > 1) {
      const pts: Pt[] = [];
      const n = e.pts.length;
      const segs = e.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = e.pts[i], b = e.pts[(i + 1) % n], bulge = e.bulges[i] || 0;
        pts.push(a);
        if (bulge) pts.push(...bulgePts(a, b, bulge));
      }
      if (!e.closed) pts.push(e.pts[n - 1]);
      polylines.push({ pts, closed: e.closed });
    } else if (e.type === 'LINE' && e.pts.length === 2) {
      polylines.push({ pts: [e.pts[0], e.pts[1]], closed: false });
    } else if (e.type === 'SPLINE' && e.pts.length > 2) {
      polylines.push({ pts: e.pts, closed: e.closed });
    }
  }
  // Chain open polylines end-to-end into closed loops (tolerance 0.02 in DXF units).
  const loops: Pt[][] = polylines.filter((p) => p.closed).map((p) => p.pts);
  const open = polylines.filter((p) => !p.closed).map((p) => p.pts.slice());
  const tol = 0.02 / scale;
  while (open.length) {
    const chain = open.shift()!;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const c = open[i];
        const end = chain[chain.length - 1];
        if (near(end, c[0], tol)) { chain.push(...c.slice(1)); open.splice(i, 1); grew = true; break; }
        if (near(end, c[c.length - 1], tol)) { chain.push(...c.slice(0, -1).reverse()); open.splice(i, 1); grew = true; break; }
      }
    }
    if (chain.length > 2 && near(chain[0], chain[chain.length - 1], tol * 5)) { chain.pop(); loops.push(chain); }
    else if (chain.length > 2) loops.push(chain); // open chain: treat as closed anyway
  }
  if (!loops.length) throw new Error('No closed outline found in the DXF');
  loops.sort((a, b) => area(b) - area(a));
  const best = loops[0].map(([x, y]) => [x * scale, -y * scale] as Pt);
  return { poly: simplify(normalize(best), 0.03), units, entities: ents.length };
}

function near(a: Pt, b: Pt, tol: number) {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): Pt[] {
  let sweep = a1 - a0;
  if (sweep <= 0) sweep += 360;
  const n = Math.max(6, Math.ceil(sweep / 8));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (sweep * i) / n) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Points along a bulge arc between a and b (excluding endpoints). */
function bulgePts(a: Pt, b: Pt, bulge: number): Pt[] {
  const theta = 4 * Math.atan(bulge);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d === 0) return [];
  const r = d / (2 * Math.sin(theta / 2));
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
  const cx = mx + nx * h, cy = my + ny * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 12)));
  const out: Pt[] = [];
  for (let i = 1; i < n; i++) {
    const t = a0 + (theta * i) / n;
    out.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]);
  }
  return out;
}
