/**
 * Measure the slab on the table with the overhead camera. A snapshot (station
 * camera on the projector PC, or this device's camera) is traced — light foam
 * on the dark table — and the outline is mapped through the camera calibration
 * for that foam's thickness into table inches. The operator sees measured vs
 * nominal size and, if the slab is short or damaged, re-nests that slab to its
 * real size (pieces that no longer fit move to the following slabs). Typing the
 * size in works too when there is no camera.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { bbox, traceImage, type Poly } from '@/lib/shapes';
import { applyH, bounds, imageToTable, type Calibration, type Pt } from '@/lib/homography';

const q4 = (n: number) => Math.round(n * 4) / 4;

export function MeasureSlab({ cal, thicknessIn, nominal, orderId, foamId, slabIndex, grade, onClose, onApplied }: {
  cal: Calibration | null;
  thicknessIn: number;
  nominal: { length: number; width: number };
  orderId?: number; foamId?: number; slabIndex?: number; grade?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [trace, setTrace] = useState<{ poly: Poly; w: number; h: number } | null>(null);
  const [asRect, setAsRect] = useState(true);
  const [manual, setManual] = useState<{ L: string; W: string }>({ L: '', W: '' });
  const [agent, setAgent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.cameraAgentStatus().then((s) => setAgent(!!s.online)).catch(() => setAgent(false)); }, []);

  const useImage = (im: HTMLImageElement) => {
    setImg(im);
    try { setTrace(traceImage(im, 800)); setMsg(''); } catch (e: any) { setTrace(null); setMsg(e.message); }
  };
  const fromStation = async () => {
    setBusy('Asking the station camera…');
    try {
      const r = await api.requestSnapshot();
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        await new Promise((res) => setTimeout(res, 700));
        const s = await api.getSnapshot(r.id - 1);
        if (s && s.id >= r.id) {
          const im = new Image();
          im.onload = () => useImage(im);
          im.src = s.jpeg.startsWith('data:') ? s.jpeg : `data:image/jpeg;base64,${s.jpeg}`;
          setBusy('');
          return;
        }
      }
      setMsg('No picture came back. Is the projector page open with "station camera" on?');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(''); }
  };
  const onFile = (f: File) => { const im = new Image(); im.onload = () => useImage(im); im.src = URL.createObjectURL(f); };

  const Hcam = useMemo(() => imageToTable(cal, thicknessIn), [cal, thicknessIn]);

  // Traced outline → table inches.
  const measured = useMemo(() => {
    if (trace && img && Hcam) {
      const k = img.naturalWidth / trace.w;
      const natural = trace.poly.map(([x, y]) => [x * k, y * k] as Pt);
      const inch = natural.map((p) => applyH(Hcam, p));
      const b = bounds(inch);
      const poly: Poly = inch.map(([x, y]) => [Math.round((x - b.minX) * 100) / 100, Math.round((y - b.minY) * 100) / 100]);
      return { length: q4(b.w), width: q4(b.h), x: Math.round(b.minX * 10) / 10, y: Math.round(b.minY * 10) / 10, poly, source: 'camera' as const };
    }
    if (Number(manual.L) > 0 && Number(manual.W) > 0) return { length: Number(manual.L), width: Number(manual.W), x: 0, y: 0, poly: null, source: 'typed' as const };
    return null;
  }, [trace, img, Hcam, manual]);

  const dL = measured ? measured.length - nominal.length : 0;
  const dW = measured ? measured.width - nominal.width : 0;
  const differs = measured && (Math.abs(dL) >= 0.25 || Math.abs(dW) >= 0.25);
  const offTable = measured?.source === 'camera' && (Math.abs(measured.x) > 1 || Math.abs(measured.y) > 1);

  const apply = async () => {
    if (!measured || !orderId || !foamId || !slabIndex) return;
    setBusy('Re-nesting…');
    try {
      await api.resizeSlab(orderId, { foamId, slabIndex, lengthIn: measured.length, widthIn: measured.width, poly: asRect ? null : measured.poly, x: measured.x, y: measured.y });
      onApplied?.();
      onClose();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(''); }
  };

  const tracePts = trace && img ? (asRect ? (() => { const b = bbox(trace.poly); return [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]] as Poly; })() : trace.poly) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 text-slate-900" onClick={onClose}>
      <div className="max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Measure the slab on the table</h2>
            <p className="text-sm text-slate-500">{grade ? `${grade} · ` : ''}slab {slabIndex ?? ''} · nominal {nominal.length}" × {nominal.width}" · {thicknessIn}" plane. Slab must be fully in the picture on the bare (dark) table, butted against the stops.</p>
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Close</button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {!cal?.camera && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">The camera is not calibrated yet (Projector & camera page). You can still type the measured size.</div>}
            <div className="flex flex-wrap gap-2">
              <button onClick={fromStation} disabled={!!busy || !cal?.camera} className="rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-40">📷 Station camera{agent === false ? ' (offline)' : ''}</button>
              <label className={`cursor-pointer rounded-lg border px-4 py-3 font-semibold ${!cal?.camera ? 'opacity-40' : ''}`}>This device's camera<input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" disabled={!cal?.camera} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
              {busy && <span className="self-center text-sm text-slate-500">{busy}</span>}
            </div>
            {img && (
              <div className="relative">
                <img src={img.src} alt="slab" className="w-full rounded-lg" />
                {tracePts && trace && (
                  <svg viewBox={`0 0 ${trace.w} ${trace.h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                    <polygon points={tracePts.map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth={trace.w / 300} />
                  </svg>
                )}
              </div>
            )}
            {msg && <div className="rounded-md border bg-slate-50 p-2 text-sm">{msg}</div>}
            <div className="rounded-md border p-3">
              <div className="mb-1 text-sm font-semibold">Or type what the tape says</div>
              <div className="flex gap-2">
                <input type="number" step="0.25" placeholder={`Length (${nominal.length})`} value={manual.L} onChange={(e) => setManual({ ...manual, L: e.target.value })} className="w-40 rounded-md border px-3 py-2 text-lg" />
                <input type="number" step="0.25" placeholder={`Width (${nominal.width})`} value={manual.W} onChange={(e) => setManual({ ...manual, W: e.target.value })} className="w-40 rounded-md border px-3 py-2 text-lg" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {measured ? (
              <div className={`rounded-lg border p-4 ${differs ? 'border-amber-400 bg-amber-50' : 'border-emerald-400 bg-emerald-50'}`}>
                <div className="text-xs uppercase tracking-wide text-slate-500">Measured ({measured.source})</div>
                <div className="text-4xl font-black">{measured.length}" × {measured.width}"</div>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    <tr><td>Length</td><td className="text-right">{nominal.length}" → <b>{measured.length}"</b></td><td className={`text-right ${Math.abs(dL) >= 0.25 ? 'font-bold text-amber-700' : 'text-slate-400'}`}>{dL >= 0 ? '+' : ''}{Math.round(dL * 4) / 4}</td></tr>
                    <tr><td>Width</td><td className="text-right">{nominal.width}" → <b>{measured.width}"</b></td><td className={`text-right ${Math.abs(dW) >= 0.25 ? 'font-bold text-amber-700' : 'text-slate-400'}`}>{dW >= 0 ? '+' : ''}{Math.round(dW * 4) / 4}</td></tr>
                  </tbody>
                </table>
                {offTable && <div className="mt-2 text-xs text-amber-800">Slab sits {measured.x}" / {measured.y}" from the table origin — push it against the stops, or the projected lines will be off by that much.</div>}
                <div className="mt-2 text-sm">{differs ? 'Not the nominal size. Re-nest this slab to what is really there; pieces that no longer fit move to the next slab.' : 'Matches the plan within ¼". Nothing to do.'}</div>
              </div>
            ) : (
              <div className="rounded-lg border p-4 text-sm text-slate-500">Take a picture or type the size to compare with the plan.</div>
            )}
            {measured?.source === 'camera' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asRect} onChange={(e) => setAsRect(e.target.checked)} /> Treat as a rectangle (untick if a corner is missing or torn)</label>}
            {orderId ? (
              <button onClick={apply} disabled={!measured || !differs || !!busy} className="w-full rounded-lg bg-amber-500 px-4 py-4 text-lg font-black text-white disabled:opacity-40">Re-nest slab {slabIndex} to measured size</button>
            ) : null}
            <button onClick={onClose} className="w-full rounded-lg border px-4 py-3 font-semibold">{differs ? 'Leave it as planned' : 'Done'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
