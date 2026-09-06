/**
 * One slab of a cut plan drawn to scale. Big labels so it reads from across the
 * shop on the cut-station screen; the operator lays cardboard templates on the
 * slab in this arrangement. Shaped pieces are drawn with their real outline.
 */
const PALETTE = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e'];

export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  rot?: number;
  poly?: [number, number][];
}
export interface SheetData {
  index: number;
  pieces: PlacedPiece[];
  utilization: number;
}

export function colorFor(label: string, keys: string[]) {
  const code = label.split(' ')[0];
  const i = keys.indexOf(code);
  return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
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

export function NestSheet({ sheet, length, width, keys, big = false }: { sheet: SheetData; length: number; width: number; keys: string[]; big?: boolean }) {
  const pad = 2;
  const vb = `-${pad} -${pad} ${length + pad * 2} ${width + pad * 2}`;
  return (
    <svg viewBox={vb} className="w-full h-auto rounded-lg border bg-white" style={{ maxHeight: big ? '70vh' : 360 }}>
      <rect x={0} y={0} width={length} height={width} fill="#fdf6e3" stroke="#333" strokeWidth={0.4} />
      {/* 6" grid so the operator can read positions off the slab */}
      {Array.from({ length: Math.floor(length / 6) }, (_, i) => <line key={`gx${i}`} x1={(i + 1) * 6} y1={0} x2={(i + 1) * 6} y2={width} stroke="#e5d9b6" strokeWidth={0.15} />)}
      {Array.from({ length: Math.floor(width / 6) }, (_, i) => <line key={`gy${i}`} x1={0} y1={(i + 1) * 6} x2={length} y2={(i + 1) * 6} stroke="#e5d9b6" strokeWidth={0.15} />)}
      {sheet.pieces.map((p, i) => {
        const fill = colorFor(p.label, keys);
        const fontSize = Math.max(1.6, Math.min(p.w, p.h) / 4.5);
        const [code, ...rest] = p.label.split(' ');
        const [cx, cy] = p.poly ? centroid(p.poly) : [p.x + p.w / 2, p.y + p.h / 2];
        return (
          <g key={i}>
            {p.poly ? (
              <polygon points={p.poly.map(([x, y]) => `${x},${y}`).join(' ')} fill={fill} fillOpacity={0.35} stroke={fill} strokeWidth={0.35} strokeLinejoin="round" />
            ) : (
              <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={fill} fillOpacity={0.35} stroke={fill} strokeWidth={0.35} />
            )}
            <text x={cx} y={cy - fontSize * 0.2} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="#111">{code}</text>
            <text x={cx} y={cy + fontSize * 0.9} textAnchor="middle" fontSize={fontSize * 0.7} fill="#333">{rest.join(' ')}</text>
            <text x={cx} y={cy + fontSize * 1.7} textAnchor="middle" fontSize={fontSize * 0.55} fill="#555">{p.w}×{p.h}{p.rot ? ` ↻${p.rot}°` : p.rotated ? ' ↻' : ''}</text>
          </g>
        );
      })}
      <text x={length / 2} y={width + pad * 0.9} textAnchor="middle" fontSize={1.8} fill="#333">
        {length}" × {width}" slab · {Math.round(sheet.utilization * 100)}% used
      </text>
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
