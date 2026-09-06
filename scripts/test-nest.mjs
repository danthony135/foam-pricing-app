// Quick sanity check of the shape nester + DXF reader against the built server.
import { packPieces } from '../server/dist/services/cutOptimizer.js';
import { parseDxf } from '../server/dist/services/dxf.js';
import { area } from '../server/dist/services/geometry.js';

const t = [[0, 0], [26, 0], [26, 4], [23, 4], [23, 24], [3, 24], [3, 4], [0, 4]]; // T-cushion 26×24, 4" ears of 3"
const wedge = [[0, 0], [22, 0], [30, 8], [30, 24], [0, 24]];
const t0 = Date.now();
const plan = packPieces(
  [
    { label: '400-30 Seat T', l: 26, w: 24, qty: 6, poly: t },
    { label: '150-15 Corner wedge', l: 30, w: 24, qty: 2, poly: wedge },
    { label: '400-30 Arm pad', l: 24, w: 8, qty: 4 },
    { label: '400-30 Back', l: 24, w: 20, qty: 3 },
  ],
  82, 36
);
console.log(`nested ${plan.pieceCount} pieces on ${plan.sheets.length} slabs, util ${Math.round(plan.utilization * 100)}%, unplaced ${plan.unplaced.length}, ${Date.now() - t0}ms`);
for (const s of plan.sheets) console.log(` slab ${s.index}: ${Math.round(s.utilization * 100)}%  ` + s.pieces.map((p) => `${p.label.split(' ')[1]}@${p.x},${p.y}${p.rot ? 'r' + p.rot : ''}${p.poly ? '*' : ''}`).join(' | '));
// overlap sanity: rasterize placed polys at 0.25 and check no cell is double-filled
for (const s of plan.sheets) {
  const grid = new Map();
  let overlaps = 0;
  for (const p of s.pieces) {
    const poly = p.poly ?? [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]];
    const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
    for (let y = Math.min(...ys) + 0.125; y < Math.max(...ys); y += 0.25)
      for (let x = Math.min(...xs) + 0.125; x < Math.max(...xs); x += 0.25) {
        // point in polygon
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        const k = `${Math.floor(x * 4)},${Math.floor(y * 4)}`;
        if (grid.has(k)) overlaps++;
        grid.set(k, 1);
        if (x > 82 || y > 36) overlaps += 1000;
      }
  }
  console.log(`  overlap cells slab ${s.index}: ${overlaps}`);
}

const dxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n1\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n90\n8\n70\n1\n10\n0\n20\n0\n10\n26\n20\n0\n10\n26\n20\n-4\n10\n23\n20\n-4\n10\n23\n20\n-24\n10\n3\n20\n-24\n10\n3\n20\n-4\n10\n0\n20\n-4\n0\nENDSEC\n0\nEOF\n`;
const r = parseDxf(dxf);
console.log('dxf →', r.units, r.entities, 'entities, area', area(r.poly).toFixed(1), 'pts', r.poly.length, JSON.stringify(r.poly));

// --- glue-ups: pieces that would open a new slab get split once into scrap ---
{
  const t0 = Date.now();
  const plan = packPieces(
    [
      { label: '500-30 Seat', l: 30, w: 26, qty: 5 },   // 2 per row (60), scrap 22" strip on the right
      { label: '500-30 Back', l: 30, w: 20, qty: 2 },
    ],
    82, 36
  );
  console.log(`glue test: ${plan.pieceCount} pieces on ${plan.sheets.length} slabs, glued ${plan.gluedPieces}, util ${Math.round(plan.utilization * 100)}%, ${Date.now() - t0}ms`);
  for (const s of plan.sheets) console.log(` slab ${s.index}: ` + s.pieces.map((p) => `${p.label.split(' ')[1]}@${p.x},${p.y} ${p.w}x${p.h}${p.glue ? ` GLUE ${p.glue.part}↔slab${p.glue.mateSlab}` : ''}`).join(' | '));
  const plainPlan = packPieces([{ label: '500-30 Seat', l: 30, w: 26, qty: 5 }, { label: '500-30 Back', l: 30, w: 20, qty: 2 }], 82, 36, { glue: false });
  console.log(` without glue: ${plainPlan.sheets.length} slabs`);
  for (const s of plan.sheets) console.log(`  slab ${s.index} scrap ${s.scrapSqIn} sq in, remnants ${JSON.stringify(s.remnants)}`);
}
