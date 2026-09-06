/**
 * Shape editor for a foam piece outline. Three ways in: a preset (T-cushion,
 * angled corner, notched corner, trapezoid, rounded end, L-shape) with
 * parameters; a DXF file; a photo of the cardboard template with a known
 * reference width. Whatever the source, the outline is then editable: drag a
 * vertex (snaps to ¼"), double-click an edge to add a vertex, right-click a
 * vertex to remove it. Returns the polygon in inches, y-down, origin top-left.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRESETS, area, bbox, normalize, simplify, snap, traceImage, type Poly } from '@/lib/shapes';

export interface ShapeResult { poly: Poly; source: string; lengthIn: number; widthIn: number; areaSqIn: number }

export function ShapeEditor({ initial, onSave, onCancel }: { initial?: Poly | null; onSave: (r: ShapeResult) => void; onCancel: () => void }) {
  const [poly, setPoly] = useState<Poly>(initial && initial.length >= 3 ? initial : PRESETS[0].build(Object.fromEntries(PRESETS[0].params.map((p) => [p.key, p.default]))));
  const [source, setSource] = useState(initial ? 'drawn' : 'preset:t-cushion');
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [params, setParams] = useState<Record<string, number>>(Object.fromEntries(PRESETS[0].params.map((p) => [p.key, p.default])));
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const [refWidth, setRefWidth] = useState('');
  const [tracePx, setTracePx] = useState<Poly | null>(null);
  const [traceDims, setTraceDims] = useState<{ w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const bb = useMemo(() => bbox(poly), [poly]);
  const maxDim = Math.max(bb.w, bb.h, 1);
  const pad = maxDim * 0.08;
  const vb = `${-pad} ${-pad} ${bb.w + pad * 2} ${bb.h + pad * 2}`;
  const sqIn = area(poly);

  const applyPreset = (id: string, p: Record<string, number>) => {
    const pr = PRESETS.find((x) => x.id === id)!;
    setPoly(normalize(pr.build(p)));
    setSource(`preset:${id}`);
  };
  useEffect(() => {
    if (source.startsWith('preset:')) applyPreset(preset, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, params]);

  const toInches = (e: React.MouseEvent | MouseEvent): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = (e as MouseEvent).clientX; pt.y = (e as MouseEvent).clientY;
    const m = svg.getScreenCTM()!.inverse();
    const p = pt.matrixTransform(m);
    return [snap(p.x), snap(p.y)];
  };
  useEffect(() => {
    if (drag === null) return;
    const move = (e: MouseEvent) => { const [x, y] = toInches(e); setPoly((q) => q.map((v, i) => (i === drag ? [x, y] : v))); setSource((s) => (s.startsWith('preset:') ? 'drawn' : s)); };
    const up = () => { setDrag(null); setPoly((q) => normalize(q)); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const addVertexOnEdge = (i: number, e: React.MouseEvent) => {
    e.preventDefault();
    const [x, y] = toInches(e);
    setPoly((q) => { const n = q.slice(); n.splice(i + 1, 0, [x, y]); return n; });
    setSource('drawn');
  };
  const removeVertex = (i: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (poly.length <= 3) return;
    setPoly((q) => q.filter((_, j) => j !== i));
    setSource('drawn');
  };

  const onDxf = async (file: File) => {
    setMsg('Reading DXF…');
    try {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
      const r = await api.parseDxf(b64);
      setPoly(r.poly); setSource('dxf'); setMsg(`DXF: ${r.entities} entities, ${r.units}, ${r.lengthIn}" × ${r.widthIn}"`);
    } catch (e: any) { setMsg(e.message); }
  };
  const onPhoto = (file: File) => {
    const img = new Image();
    img.onload = () => {
      try {
        const t = traceImage(img);
        setTracePx(t.poly); setTraceDims({ w: t.w, h: t.h });
        setMsg('Template traced. Enter its real width (left-to-right on the photo) in inches, then Apply.');
      } catch (e: any) { setMsg(e.message); }
    };
    img.src = URL.createObjectURL(file);
  };
  const applyTrace = () => {
    if (!tracePx || !refWidth) return;
    const b = bbox(tracePx);
    const k = Number(refWidth) / b.w;
    const p = normalize(tracePx.map(([x, y]) => [x * k, y * k] as [number, number]));
    setPoly(simplify(p, 0.1).map(([x, y]) => [snap(x, 0.125), snap(y, 0.125)]));
    setSource('photo');
    setMsg('Traced outline loaded — drag vertices to true it up if needed.');
  };
  const rotate = () => { setPoly(normalize(poly.map(([x, y]) => [-y, x]))); };
  const mirror = () => { setPoly(normalize(poly.map(([x, y]) => [-x, y]))); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="flex h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-lg font-bold">Piece outline</div>
            <div className="text-xs text-muted-foreground">{bb.w.toFixed(2)}" × {bb.h.toFixed(2)}" · {sqIn.toFixed(1)} sq in · {poly.length} points · source {source}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={rotate}>Rotate 90°</Button>
            <Button variant="outline" size="sm" onClick={mirror}>Mirror</Button>
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={() => onSave({ poly: normalize(poly), source, lengthIn: bb.w, widthIn: bb.h, areaSqIn: sqIn })}>Use this outline</Button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-80 shrink-0 space-y-4 overflow-auto border-r p-4 text-sm">
            <div>
              <div className="mb-1 font-semibold">Preset shape</div>
              <select className="w-full rounded-md border bg-background px-2 py-2" value={preset} onChange={(e) => { const pr = PRESETS.find((x) => x.id === e.target.value)!; setPreset(pr.id); setParams(Object.fromEntries(pr.params.map((p) => [p.key, p.default]))); setSource(`preset:${pr.id}`); }}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="mt-2 space-y-2">
                {PRESETS.find((x) => x.id === preset)!.params.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{p.label}</span>
                    <Input className="w-24" type="number" step={p.step ?? 0.25} min={p.min ?? 0} value={params[p.key] ?? p.default} onChange={(e) => { setParams({ ...params, [p.key]: Number(e.target.value) }); setSource(`preset:${preset}`); }} />
                  </label>
                ))}
              </div>
              {!source.startsWith('preset:') && <button className="mt-1 text-xs text-primary hover:underline" onClick={() => applyPreset(preset, params)}>Reset to this preset</button>}
            </div>
            <div className="border-t pt-3">
              <div className="mb-1 font-semibold">Import DXF</div>
              <input type="file" accept=".dxf" className="text-xs" onChange={(e) => e.target.files?.[0] && onDxf(e.target.files[0])} />
              <div className="mt-1 text-xs text-muted-foreground">Largest closed outline is used. Inches unless the file says mm.</div>
            </div>
            <div className="border-t pt-3">
              <div className="mb-1 font-semibold">Trace a photo of the template</div>
              <input type="file" accept="image/*" capture="environment" className="text-xs" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
              <div className="mt-1 text-xs text-muted-foreground">Lay the cardboard flat on a plain contrasting floor, shoot straight down, whole template in frame.</div>
              {tracePx && (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="number" step="0.25" placeholder='Real width (in)' value={refWidth} onChange={(e) => setRefWidth(e.target.value)} />
                  <Button size="sm" onClick={applyTrace} disabled={!refWidth}>Apply</Button>
                </div>
              )}
              {traceDims && <div className="mt-1 text-xs text-muted-foreground">Traced {tracePx?.length} points from a {traceDims.w}×{traceDims.h}px image.</div>}
            </div>
            <div className="border-t pt-3 text-xs text-muted-foreground">
              <b>Editing:</b> drag a point (snaps to ¼"). Double-click an edge to add a point. Right-click a point to remove it. Grid lines are 1".
            </div>
            {msg && <div className="rounded-md bg-muted p-2 text-xs">{msg}</div>}
          </aside>
          <div className="flex flex-1 items-center justify-center bg-muted/30 p-4">
            <svg ref={svgRef} viewBox={vb} className="h-full w-full select-none" onContextMenu={(e) => e.preventDefault()}>
              {Array.from({ length: Math.ceil(bb.w) + 1 }, (_, i) => <line key={`x${i}`} x1={i} y1={0} x2={i} y2={bb.h} stroke="#ddd" strokeWidth={maxDim / 400} />)}
              {Array.from({ length: Math.ceil(bb.h) + 1 }, (_, i) => <line key={`y${i}`} x1={0} y1={i} x2={bb.w} y2={i} stroke="#ddd" strokeWidth={maxDim / 400} />)}
              <polygon points={poly.map(([x, y]) => `${x},${y}`).join(' ')} fill="#f97316" fillOpacity={0.25} stroke="#f97316" strokeWidth={maxDim / 120} strokeLinejoin="round" />
              {poly.map(([x, y], i) => {
                const [nx, ny] = poly[(i + 1) % poly.length];
                return <line key={`e${i}`} x1={x} y1={y} x2={nx} y2={ny} stroke="transparent" strokeWidth={maxDim / 25} onDoubleClick={(e) => addVertexOnEdge(i, e)} style={{ cursor: 'copy' }} />;
              })}
              {poly.map(([x, y], i) => (
                <g key={`v${i}`}>
                  <circle cx={x} cy={y} r={maxDim / 45} fill="#fff" stroke="#111" strokeWidth={maxDim / 250} style={{ cursor: 'grab' }} onMouseDown={(e) => { e.preventDefault(); setDrag(i); }} onContextMenu={(e) => removeVertex(i, e)} />
                  <text x={x + maxDim / 40} y={y - maxDim / 40} fontSize={maxDim / 40} fill="#333">{x},{y}</text>
                </g>
              ))}
              {/* dimension labels */}
              <text x={bb.w / 2} y={-pad / 3} textAnchor="middle" fontSize={maxDim / 28} fill="#333">{bb.w.toFixed(2)}"</text>
              <text x={-pad / 3} y={bb.h / 2} textAnchor="middle" fontSize={maxDim / 28} fill="#333" transform={`rotate(-90 ${-pad / 3} ${bb.h / 2})`}>{bb.h.toFixed(2)}"</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
