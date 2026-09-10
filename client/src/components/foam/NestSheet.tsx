/**
 * One slab of a cut plan drawn to scale. Big labels so it reads from across the
 * shop on the cut-station screen; the operator lays cardboard templates on the
 * slab in this arrangement. Shaped pieces are drawn with their real outline.
 * Colour comes from `colorOf` (per production order on the cut station, per
 * SKU on the office view). `rotate` turns the slab 90° so its long side runs
 * down a portrait screen.
 */
export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  rot?: number;
  poly?: [number, number][];
  mo?: string;
  glue?: { group: string; part: 'A' | 'B'; seam: [number, number, number, number]; mateSlab?: number; wholeL: number; wholeW: number };
}
export interface SheetData {
  index: number;
  pieces: PlacedPiece[];
  utilization: number;
  scrapSqIn?: number;
  remnants?: { x: number; y: number; w: number; h: number }[];
  /** Measured stock when the slab was re-nested to its real size. */
  stock?: { length: number; width: number; poly?: [number, number][]; x?: number; y?: number };
}

/** 24 well-separated colours (golden-angle hues, alternating lightness). */
export function paletteColor(i: number): string {
  const hue = (i * 137.508) % 360;
  const light = i % 2 ? 62 : 48;
  return `hsl(${hue.toFixed(0)} 78% ${light}%)`;
}

/** Stable colour map for a set of keys (MO numbers or SKU codes). */
export function makeColorMap(keys: string[]): Map<string, string> {
  const uniq = [...new Set(keys)];
  return new Map(uniq.map((k, i) => [k, paletteColor(i)]));
}

/** Legacy helper for pages that colour by SKU code. */
export function colorFor(label: string, keys: string[]) {
  const code = label.split(' ')[0];
  const i = keys.indexOf(code);
  return paletteColor(i >= 0 ? i : 0);
}

function centroid(poly: [number, number][]): [number, number] {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f; cy += (y1 + y2) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

export function NestSheet({
  sheet, length, width, colorOf, big = false, rotate = false, showMo = true, stockPoly, caption,
}: {
  sheet: SheetData; length: number; width: number;
  colorOf: (p: PlacedPiece) => string;
  big?: boolean; rotate?: boolean; showMo?: boolean;
  /** Irregular stock (a remnant outline) instead of a full rectangular slab. */
  stockPoly?: [number, number][] | null;
  caption?: string;
}) {
  const pad = 2;
  const stockPts = stockPoly && stockPoly.length >= 3 ? stockPoly.map(([x, y]) => `${x},${y}`).join(' ') : null;
  const clipId = `stock-${sheet.index}-${length}-${width}`;
  // Rotated: the viewBox is width × length and the slab group is turned 90° clockwise.
  const vb = rotate ? `-${pad} -${pad} ${width + pad * 2} ${length + pad * 2}` : `-${pad} -${pad} ${length + pad * 2} ${width + pad * 2}`;
  const groupTransform = rotate ? `translate(${width} 0) rotate(90)` : undefined;
  return (
    <svg viewBox={vb} className="w-full h-full rounded-lg border bg-white" style={big ? { maxHeight: '100%', maxWidth: '100%' } : { maxHeight: 360, height: 'auto' }} preserveAspectRatio="xMidYMid meet">
      <g transform={groupTransform}>
        {stockPts && <defs><clipPath id={clipId}><polygon points={stockPts} /></clipPath></defs>}
        {stockPts ? (
          <polygon points={stockPts} fill="#fdf6e3" stroke="#333" strokeWidth={0.4} strokeLinejoin="round" />
        ) : (
          <rect x={0} y={0} width={length} height={width} fill="#fdf6e3" stroke="#333" strokeWidth={0.4} />
        )}
        <g clipPath={stockPts ? `url(#${clipId})` : undefined}>
          {Array.from({ length: Math.floor(length / 6) }, (_, i) => <line key={`gx${i}`} x1={(i + 1) * 6} y1={0} x2={(i + 1) * 6} y2={width} stroke="#e5d9b6" strokeWidth={0.15} />)}
          {Array.from({ length: Math.floor(width / 6) }, (_, i) => <line key={`gy${i}`} x1={0} y1={(i + 1) * 6} x2={length} y2={(i + 1) * 6} stroke="#e5d9b6" strokeWidth={0.15} />)}
        </g>
        {(sheet.remnants ?? []).map((m, i) => (
          <g key={`rem${i}`}>
            <rect x={m.x} y={m.y} width={m.w} height={m.h} fill="none" stroke="#9a8f6a" strokeWidth={0.2} strokeDasharray="0.8 0.6" />
            <text x={m.x + m.w / 2} y={m.y + m.h / 2 + 0.6} textAnchor="middle" fontSize={Math.max(1.2, Math.min(m.w, m.h) / 5)} fill="#9a8f6a" transform={rotate ? `rotate(-90 ${m.x + m.w / 2} ${m.y + m.h / 2})` : undefined}>scrap {m.w}×{m.h}</text>
          </g>
        ))}
        {sheet.pieces.map((p, i) => {
          const fill = colorOf(p);
          const fontSize = Math.max(1.5, Math.min(p.w, p.h) / 4.8);
          const [code, ...rest] = p.label.split(' ');
          const [cx, cy] = p.poly ? centroid(p.poly) : [p.x + p.w / 2, p.y + p.h / 2];
          // Keep text upright on a rotated slab.
          const textTransform = rotate ? `rotate(-90 ${cx} ${cy})` : undefined;
          const mo = showMo && p.mo ? p.mo.replace(/^WH\/MO\//, 'MO ') : null;
          return (
            <g key={i}>
              {p.poly ? (
                <polygon points={p.poly.map(([x, y]) => `${x},${y}`).join(' ')} fill={fill} fillOpacity={0.45} stroke={fill} strokeWidth={0.4} strokeLinejoin="round" />
              ) : (
                <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={fill} fillOpacity={0.45} stroke={fill} strokeWidth={0.4} />
              )}
              {p.glue && <line x1={p.glue.seam[0]} y1={p.glue.seam[1]} x2={p.glue.seam[2]} y2={p.glue.seam[3]} stroke="#111" strokeWidth={0.9} strokeDasharray="1.2 0.8" strokeLinecap="round" />}
              <g transform={textTransform}>
                {p.glue && <text x={cx} y={cy - fontSize * 1.5} textAnchor="middle" fontSize={fontSize * 0.7} fontWeight={800} fill="#b91c1c">GLUE {p.glue.part}{p.glue.mateSlab ? ` ↔ slab ${p.glue.mateSlab}` : ''} · {p.glue.wholeL}×{p.glue.wholeW}</text>}
                <text x={cx} y={cy - fontSize * 0.55} textAnchor="middle" fontSize={fontSize} fontWeight={800} fill="#111">{code}</text>
                {mo && <text x={cx} y={cy + fontSize * 0.45} textAnchor="middle" fontSize={fontSize * 0.9} fontWeight={800} fill="#000">{mo}</text>}
                <text x={cx} y={cy + fontSize * (mo ? 1.2 : 0.35)} textAnchor="middle" fontSize={fontSize * 0.62} fill="#222">{rest.join(' ')}</text>
                <text x={cx} y={cy + fontSize * (mo ? 1.85 : 1.0)} textAnchor="middle" fontSize={fontSize * 0.5} fill="#444">{p.w}×{p.h}{p.rot ? ` ↻${p.rot}°` : p.rotated ? ' ↻' : ''}</text>
              </g>
            </g>
          );
        })}
        <text x={length / 2} y={width + pad * 0.9} textAnchor="middle" fontSize={1.8} fill="#333" transform={rotate ? `rotate(-90 ${length / 2} ${width + pad * 0.9}) translate(0 ${-pad * 0.9 - 1})` : undefined}>
          {caption ?? `${length}" × ${width}" slab · ${Math.round(sheet.utilization * 100)}% used`}
        </text>
      </g>
    </svg>
  );
}

/** Tiny outline preview for a pattern row. */
export function PieceThumb({ poly, l, w, size = 44 }: { poly?: [number, number][] | null; l: number; w: number; size?: number }) {
  const pts = poly && poly.length >= 3 ? poly : [[0, 0], [l, 0], [l, w], [0, w]] as [number, number][];
  const maxDim = Math.max(l, w, 1);
  return (
    <svg viewBox={`-0.5 -0.5 ${maxDim + 1} ${maxDim + 1}`} width={size} height={size} className="rounded border bg-white">
      <polygon points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="#f97316" fillOpacity={0.3} stroke="#f97316" strokeWidth={maxDim / 60} />
    </svg>
  );
}
