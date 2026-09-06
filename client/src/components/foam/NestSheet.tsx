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
}
export interface SheetData {
  index: number;
  pieces: PlacedPiece[];
  utilization: number;
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
  sheet, length, width, colorOf, big = false, rotate = false, showMo = true,
}: {
  sheet: SheetData; length: number; width: number;
  colorOf: (p: PlacedPiece) => string;
  big?: boolean; rotate?: boolean; showMo?: boolean;
}) {
  const pad = 2;
  // Rotated: the viewBox is width × length and the slab group is turned 90° clockwise.
  const vb = rotate ? `-${pad} -${pad} ${width + pad * 2} ${length + pad * 2}` : `-${pad} -${pad} ${length + pad * 2} ${width + pad * 2}`;
  const groupTransform = rotate ? `translate(${width} 0) rotate(90)` : undefined;
  return (
    <svg viewBox={vb} className="w-full h-full rounded-lg border bg-white" style={big ? { maxHeight: '100%', maxWidth: '100%' } : { maxHeight: 360, height: 'auto' }} preserveAspectRatio="xMidYMid meet">
      <g transform={groupTransform}>
        <rect x={0} y={0} width={length} height={width} fill="#fdf6e3" stroke="#333" strokeWidth={0.4} />
        {Array.from({ length: Math.floor(length / 6) }, (_, i) => <line key={`gx${i}`} x1={(i + 1) * 6} y1={0} x2={(i + 1) * 6} y2={width} stroke="#e5d9b6" strokeWidth={0.15} />)}
        {Array.from({ length: Math.floor(width / 6) }, (_, i) => <line key={`gy${i}`} x1={0} y1={(i + 1) * 6} x2={length} y2={(i + 1) * 6} stroke="#e5d9b6" strokeWidth={0.15} />)}
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
              <g transform={textTransform}>
                {mo && <text x={cx} y={cy - fontSize * 1.05} textAnchor="middle" fontSize={fontSize * 0.95} fontWeight={800} fill="#000">{mo}</text>}
                <text x={cx} y={cy + (mo ? fontSize * 0.05 : -fontSize * 0.2)} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="#111">{code}</text>
                <text x={cx} y={cy + (mo ? fontSize * 0.95 : fontSize * 0.7)} textAnchor="middle" fontSize={fontSize * 0.65} fill="#222">{rest.join(' ')}</text>
                <text x={cx} y={cy + (mo ? fontSize * 1.7 : fontSize * 1.45)} textAnchor="middle" fontSize={fontSize * 0.5} fill="#444">{p.w}×{p.h}{p.rot ? ` ↻${p.rot}°` : p.rotated ? ' ↻' : ''}</text>
              </g>
            </g>
          );
        })}
        <text x={length / 2} y={width + pad * 0.9} textAnchor="middle" fontSize={1.8} fill="#333" transform={rotate ? `rotate(-90 ${length / 2} ${width + pad * 0.9}) translate(0 ${-pad * 0.9 - 1})` : undefined}>
          {length}" × {width}" slab · {Math.round(sheet.utilization * 100)}% used
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
