/**
 * One slab of a cut plan drawn to scale. Big labels so it reads from across the
 * shop on the cut-station screen; the operator lays cardboard templates on the
 * slab in this arrangement.
 */
const PALETTE = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e'];

export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
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

export function NestSheet({ sheet, length, width, keys, big = false }: { sheet: SheetData; length: number; width: number; keys: string[]; big?: boolean }) {
  const pad = 2;
  const vb = `-${pad} -${pad} ${length + pad * 2} ${width + pad * 2}`;
  return (
    <svg viewBox={vb} className="w-full h-auto rounded-lg border bg-white" style={{ maxHeight: big ? '70vh' : 360 }}>
      <rect x={0} y={0} width={length} height={width} fill="#fdf6e3" stroke="#333" strokeWidth={0.4} />
      {sheet.pieces.map((p, i) => {
        const fill = colorFor(p.label, keys);
        const fontSize = Math.max(1.6, Math.min(p.w, p.h) / 4.5);
        const [code, ...rest] = p.label.split(' ');
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={fill} fillOpacity={0.35} stroke={fill} strokeWidth={0.35} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 - fontSize * 0.2} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="#111">
              {code}
            </text>
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fontSize * 0.9} textAnchor="middle" fontSize={fontSize * 0.7} fill="#333">
              {rest.join(' ')}
            </text>
            <text x={p.x + p.w / 2} y={p.y + p.h - fontSize * 0.4} textAnchor="middle" fontSize={fontSize * 0.6} fill="#555">
              {p.w}×{p.h}{p.rotated ? ' ↻' : ''}
            </text>
          </g>
        );
      })}
      <text x={length / 2} y={width + pad * 0.9} textAnchor="middle" fontSize={1.8} fill="#333">
        {length}" × {width}" slab · {Math.round(sheet.utilization * 100)}% used
      </text>
    </svg>
  );
}
