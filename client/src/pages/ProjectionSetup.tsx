/**
 * Projector & camera setup — the calibration wizard (run from the tablet).
 *
 *  1. Reference slab: the full slab size you will butt against the table stops
 *     (default the 82×36 stock slab). Its corner nearest the stops is (0,0).
 *  2. Projector planes: with a real slab of a given thickness on the table, the
 *     projector shows four numbered crosshairs; nudge each onto the matching
 *     slab corner and save. Do it for the table (0") or a thin slab AND for a
 *     thick slab — the app interpolates every other thickness.
 *  3. Camera planes: snapshot of the same slab, tap its four corners in order.
 *  4. Test: 6" grid on the table, slab measurement dry run, line prefs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { type Calibration, type Plane, type Pt } from '@/lib/homography';
import { MeasureSlab } from '@/components/foam/MeasureSlab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CORNER_NAMES = ['1 · top-left (0,0)', '2 · top-right (L,0)', '3 · bottom-right (L,W)', '4 · bottom-left (0,W)'];
const EMPTY: Calibration = { refLengthIn: 82, refWidthIn: 36, projector: null, camera: null };

export default function ProjectionSetup() {
  const [cal, setCal] = useState<Calibration>(EMPTY);
  const [state, setState] = useState<any>(null);
  const [prefs, setPrefs] = useState<any>({});
  const [foams, setFoams] = useState<any[]>([]);
  const [agent, setAgent] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  // projector plane editing
  const [editThk, setEditThk] = useState<number | null>(null);
  const [step, setStep] = useState(5);
  // camera plane editing
  const [camThk, setCamThk] = useState<number | null>(null);
  const [camImg, setCamImg] = useState<{ src: string; w: number; h: number } | null>(null);
  const [taps, setTaps] = useState<Pt[]>([]);
  const [camBusy, setCamBusy] = useState('');
  const [measure, setMeasure] = useState<number | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, f, a] = await Promise.all([api.getStation(), api.getFoams(), api.cameraAgentStatus().catch(() => ({ online: false }))]);
      setState(s.state); setPrefs(s.prefs); setAgent(!!a.online);
      if (s.calibration) setCal({ ...EMPTY, ...s.calibration });
      setFoams(f.filter((x: any) => x.thicknessIn));
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  const save = async (next: Calibration) => {
    try { const r = await api.saveCalibration(next); setCal({ ...EMPTY, ...r }); flash('Saved'); } catch (e: any) { setErr(e.message); }
  };
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 1800); };
  const setMode = (patch: any) => api.setStationState(patch).then(setState).catch((e) => setErr(e.message));

  // ---- projector plane editing -------------------------------------------
  const startEdit = (thk: number) => {
    const existing = cal.projector?.planes.find((p) => p.thicknessIn === thk);
    setEditThk(thk);
    setMode({ mode: 'calibrate', calibrate: { thicknessIn: thk, active: 0, corners: existing?.corners ?? null, screenW: existing ? cal.projector?.screenW : undefined, screenH: existing ? cal.projector?.screenH : undefined } });
  };
  const corners: Pt[] | null = state?.calibrate?.corners ?? null;
  const active: number = state?.calibrate?.active ?? 0;
  const pushCorners = (c: Pt[], act = active) => {
    setState((s: any) => ({ ...s, calibrate: { ...s.calibrate, corners: c, active: act } }));
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => api.setStationState({ calibrate: { ...(state?.calibrate ?? {}), corners: c, active: act } }).catch(() => {}), 100);
  };
  const nudge = (dx: number, dy: number) => { if (!corners) return; pushCorners(corners.map((q, i) => (i === active ? ([q[0] + dx, q[1] + dy] as Pt) : q))); };
  const savePlane = () => {
    if (!corners || editThk === null) return;
    const planes = (cal.projector?.planes ?? []).filter((p) => p.thicknessIn !== editThk);
    planes.push({ thicknessIn: editThk, corners: corners as Plane['corners'] });
    planes.sort((a, b) => a.thicknessIn - b.thicknessIn);
    save({ ...cal, projector: { screenW: state?.calibrate?.screenW, screenH: state?.calibrate?.screenH, planes } });
    setEditThk(null);
    setMode({ mode: 'idle', calibrate: null });
  };
  const cancelEdit = () => { setEditThk(null); setMode({ mode: 'idle', calibrate: null }); };
  const deletePlane = (which: 'projector' | 'camera', thk: number) => {
    const dev = cal[which]; if (!dev) return;
    save({ ...cal, [which]: { ...dev, planes: dev.planes.filter((p) => p.thicknessIn !== thk) } });
  };

  // ---- camera plane editing -----------------------------------------------
  const snapStation = async () => {
    setCamBusy('Asking the station camera…');
    try {
      const r = await api.requestSnapshot();
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        await new Promise((res) => setTimeout(res, 700));
        const s = await api.getSnapshot(r.id - 1);
        if (s && s.id >= r.id) { setCamImg({ src: s.jpeg, w: s.w, h: s.h }); setTaps([]); setCamBusy(''); return; }
      }
      setErr('No picture came back — open /projector on the PC with the camera and turn "station camera" on (key C).');
    } catch (e: any) { setErr(e.message); } finally { setCamBusy(''); }
  };
  const snapFile = (f: File) => { const im = new Image(); im.onload = () => { setCamImg({ src: im.src, w: im.naturalWidth, h: im.naturalHeight }); setTaps([]); }; im.src = URL.createObjectURL(f); };
  const onTap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!camImg || taps.length >= 4) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * camImg.w, y = ((e.clientY - r.top) / r.height) * camImg.h;
    setTaps([...taps, [Math.round(x), Math.round(y)]]);
  };
  const saveCamPlane = () => {
    if (!camImg || taps.length !== 4 || camThk === null) return;
    const planes = (cal.camera?.planes ?? []).filter((p) => p.thicknessIn !== camThk);
    planes.push({ thicknessIn: camThk, corners: taps as Plane['corners'] });
    planes.sort((a, b) => a.thicknessIn - b.thicknessIn);
    save({ ...cal, camera: { imgW: camImg.w, imgH: camImg.h, planes } });
    setCamThk(null); setCamImg(null); setTaps([]);
  };

  const thicknessChoices = [0, ...new Set(foams.map((f) => Number(f.thicknessIn)))].sort((a, b) => a - b);
  const projectorUrl = `${location.origin}/projector`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projector & camera</h1>
          <p className="text-sm text-slate-500">Calibrate once per table. Open <code className="rounded bg-slate-100 px-1">{projectorUrl}</code> on the PC that drives the projector, drag it onto the projector screen, press <b>F</b>. Turn its <b>station camera</b> on (key <b>C</b>) if the USB camera is on that PC.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 font-semibold ${agent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>station camera {agent ? 'online' : 'offline'}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">projector: {state?.mode ?? '…'}</span>
          {note && <span className="text-emerald-700">{note}</span>}
        </div>
      </div>
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">{err} <button className="ml-2 underline" onClick={() => setErr('')}>dismiss</button></div>}

      {/* 1. reference slab */}
      <Card>
        <CardHeader><CardTitle className="text-base">1 · Reference slab</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Length (in)<input type="number" step="0.25" value={cal.refLengthIn} onChange={(e) => setCal({ ...cal, refLengthIn: Number(e.target.value) })} className="mt-1 block w-32 rounded-md border px-3 py-2 text-lg" /></label>
          <label className="text-sm font-semibold">Width (in)<input type="number" step="0.25" value={cal.refWidthIn} onChange={(e) => setCal({ ...cal, refWidthIn: Number(e.target.value) })} className="mt-1 block w-32 rounded-md border px-3 py-2 text-lg" /></label>
          <button onClick={() => save(cal)} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Save size</button>
          <div className="text-xs text-slate-500">A full slab of this size, pushed into the table stops, is the ruler for everything. Its corner in the stops is (0,0) — the top-left of the picture on the TV. Changing the size after calibrating means re-calibrating.</div>
        </CardContent>
      </Card>

      {/* 2. projector planes */}
      <Card>
        <CardHeader><CardTitle className="text-base">2 · Projector — where the slab corners land on screen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(cal.projector?.planes ?? []).map((p) => (
              <div key={p.thicknessIn} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="font-bold">{p.thicknessIn}" plane</span>
                <button onClick={() => startEdit(p.thicknessIn)} className="rounded border px-2 py-1 text-xs">Adjust</button>
                <button onClick={() => deletePlane('projector', p.thicknessIn)} className="rounded border px-2 py-1 text-xs text-red-700">✕</button>
              </div>
            ))}
            {!cal.projector?.planes?.length && <div className="text-sm text-slate-500">No planes yet. Calibrate the table (0") and one thick slab for best results.</div>}
          </div>
          {editThk === null ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Add / redo a plane:</span>
              {thicknessChoices.map((t) => <button key={t} onClick={() => startEdit(t)} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-100">{t === 0 ? 'Table (0")' : `${t}" slab`}</button>)}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
              <div className="font-bold">Calibrating the {editThk === 0 ? 'table' : `${editThk}" slab`} plane</div>
              <div className="text-sm text-slate-700">{editThk === 0 ? 'Mark the reference rectangle on the bare table (tape at the 4 corners), ' : `Put a ${editThk}" slab of ${cal.refLengthIn}×${cal.refWidthIn} in the stops, `}then move each crosshair onto its corner. You can also drag them with the mouse on the projector PC.</div>
              {!corners ? <div className="mt-3 text-sm text-slate-500">Waiting for the projector page to report its screen…</div> : (
                <div className="mt-3 grid gap-4 md:grid-cols-[1fr_260px]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {CORNER_NAMES.map((n, i) => <button key={i} onClick={() => pushCorners(corners, i)} className={`rounded-lg px-3 py-2 text-sm font-bold ${active === i ? 'bg-amber-500 text-white' : 'border bg-white'}`}>{n}</button>)}
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="grid grid-cols-3 gap-1">
                        <span /><button onClick={() => nudge(0, -step)} className="h-14 w-14 rounded-lg bg-white text-2xl font-black shadow">↑</button><span />
                        <button onClick={() => nudge(-step, 0)} className="h-14 w-14 rounded-lg bg-white text-2xl font-black shadow">←</button>
                        <div className="flex h-14 w-14 items-center justify-center text-xs text-slate-500">{step}px</div>
                        <button onClick={() => nudge(step, 0)} className="h-14 w-14 rounded-lg bg-white text-2xl font-black shadow">→</button>
                        <span /><button onClick={() => nudge(0, step)} className="h-14 w-14 rounded-lg bg-white text-2xl font-black shadow">↓</button><span />
                      </div>
                      <div className="flex flex-col gap-1">{[1, 5, 25].map((s) => <button key={s} onClick={() => setStep(s)} className={`rounded px-3 py-1 text-sm ${step === s ? 'bg-slate-900 text-white' : 'border bg-white'}`}>{s} px</button>)}</div>
                      <div className="text-xs text-slate-500">Corner {active + 1}: {Math.round(corners[active][0])}, {Math.round(corners[active][1])} px on a {state?.calibrate?.screenW}×{state?.calibrate?.screenH} screen</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={savePlane} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white">Save {editThk}" plane</button>
                      <button onClick={cancelEdit} className="rounded-lg border bg-white px-5 py-3 font-semibold">Cancel</button>
                    </div>
                  </div>
                  <MiniMap corners={corners} active={active} w={state?.calibrate?.screenW ?? 1920} h={state?.calibrate?.screenH ?? 1080} onDrag={(i, p) => pushCorners(corners.map((q, k) => (k === i ? p : q)), i)} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. camera planes */}
      <Card>
        <CardHeader><CardTitle className="text-base">3 · Camera — where the slab corners are in the picture</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(cal.camera?.planes ?? []).map((p) => (
              <div key={p.thicknessIn} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="font-bold">{p.thicknessIn}" plane</span>
                <button onClick={() => deletePlane('camera', p.thicknessIn)} className="rounded border px-2 py-1 text-xs text-red-700">✕</button>
              </div>
            ))}
            {!cal.camera?.planes?.length && <div className="text-sm text-slate-500">No camera planes yet. Needed for slab measurement.</div>}
          </div>
          {camThk === null ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Add / redo a plane:</span>
              {thicknessChoices.map((t) => <button key={t} onClick={() => { setCamThk(t); setCamImg(null); setTaps([]); }} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-100">{t === 0 ? 'Table (0")' : `${t}" slab`}</button>)}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-sky-400 bg-sky-50 p-4">
              <div className="font-bold">Camera plane for the {camThk === 0 ? 'table marks' : `${camThk}" slab`}</div>
              <div className="text-sm text-slate-700">Same slab in the stops. Take a picture, then tap its four corners in order: 1 top-left (the corner in the stops), 2 top-right, 3 bottom-right, 4 bottom-left — matching the picture on the TV.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={snapStation} disabled={!!camBusy} className="rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-40">📷 Station camera</button>
                <label className="cursor-pointer rounded-lg border bg-white px-4 py-3 font-semibold">This device's camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && snapFile(e.target.files[0])} /></label>
                {camBusy && <span className="self-center text-sm text-slate-500">{camBusy}</span>}
                <span className="ml-auto self-center text-sm font-semibold">{taps.length}/4 corners</span>
                <button onClick={() => setTaps(taps.slice(0, -1))} disabled={!taps.length} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40">Undo tap</button>
              </div>
              {camImg && (
                <div className="relative mt-3">
                  <img src={camImg.src} alt="camera" className="w-full rounded-lg" />
                  <svg viewBox={`0 0 ${camImg.w} ${camImg.h}`} className="absolute inset-0 h-full w-full cursor-crosshair" preserveAspectRatio="none" onClick={onTap}>
                    {taps.length > 1 && <polyline points={taps.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth={camImg.w / 400} />}
                    {taps.length === 4 && <polygon points={taps.map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth={camImg.w / 400} />}
                    {taps.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={camImg.w / 120} fill="none" stroke="#f59e0b" strokeWidth={camImg.w / 400} /><text x={x + camImg.w / 100} y={y - camImg.w / 100} fill="#f59e0b" fontSize={camImg.w / 40} fontWeight={800}>{i + 1}</text></g>)}
                  </svg>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={saveCamPlane} disabled={taps.length !== 4} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-40">Save {camThk}" camera plane</button>
                <button onClick={() => { setCamThk(null); setCamImg(null); setTaps([]); }} className="rounded-lg border bg-white px-5 py-3 font-semibold">Cancel</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. test + prefs */}
      <Card>
        <CardHeader><CardTitle className="text-base">4 · Test & line style</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Show on the table:</span>
            {thicknessChoices.map((t) => <button key={t} onClick={() => setMode({ mode: 'grid', gridThickness: t })} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-100">6" grid at {t}"</button>)}
            <button onClick={() => setMode({ mode: 'idle' })} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-100">Blank</button>
            <span className="mx-2 text-slate-300">|</span>
            {thicknessChoices.filter((t) => t > 0).map((t) => <button key={t} onClick={() => setMeasure(t)} className="rounded-full border border-emerald-500 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50">Measure a {t}" slab (dry run)</button>)}
          </div>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <label>Line width (px)<input type="number" min={1} max={12} value={prefs.lineWidth ?? 3} onChange={(e) => setPrefs({ ...prefs, lineWidth: Number(e.target.value) })} className="mt-1 block w-24 rounded-md border px-2 py-1.5" /></label>
            <label>Label size (px)<input type="number" min={8} max={60} value={prefs.labelSize ?? 22} onChange={(e) => setPrefs({ ...prefs, labelSize: Number(e.target.value) })} className="mt-1 block w-24 rounded-md border px-2 py-1.5" /></label>
            <label>Colour<select value={prefs.colorMode ?? 'mo'} onChange={(e) => setPrefs({ ...prefs, colorMode: e.target.value })} className="mt-1 block rounded-md border bg-white px-2 py-1.5"><option value="mo">per production order</option><option value="single">single colour</option></select></label>
            {prefs.colorMode === 'single' && <label>Colour<input type="color" value={prefs.color ?? '#00ff66'} onChange={(e) => setPrefs({ ...prefs, color: e.target.value })} className="mt-1 block h-9 w-14 rounded-md border" /></label>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.showLabels ?? true} onChange={(e) => setPrefs({ ...prefs, showLabels: e.target.checked })} /> labels</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.showOutline ?? true} onChange={(e) => setPrefs({ ...prefs, showOutline: e.target.checked })} /> slab outline</label>
            <button onClick={() => api.saveStationPrefs(prefs).then(() => flash('Prefs saved')).catch((e) => setErr(e.message))} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Save style</button>
          </div>
          <div className="text-xs text-slate-500">On the Cut Station, turn on <b>Project</b> and the slab on screen is also on the table. <Link to="/cut-station" className="underline">Open the Cut Station</Link>.</div>
        </CardContent>
      </Card>

      {measure !== null && <MeasureSlab cal={cal} thicknessIn={measure} nominal={{ length: cal.refLengthIn, width: cal.refWidthIn }} grade={`${measure}" test`} onClose={() => setMeasure(null)} />}
    </div>
  );
}

/** Small picture of the projector screen with the four corners, draggable. */
function MiniMap({ corners, active, w, h, onDrag }: { corners: Pt[]; active: number; w: number; h: number; onDrag: (i: number, p: Pt) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const toScreen = (e: React.PointerEvent): Pt => { const r = ref.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h]; };
  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className="w-full touch-none rounded-lg border bg-black" onPointerMove={(e) => drag !== null && onDrag(drag, toScreen(e))} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      <polygon points={corners.map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(0,255,102,0.1)" stroke="#00ff66" strokeWidth={w / 400} />
      {corners.map(([x, y], i) => (
        <g key={i} onPointerDown={(e) => { e.preventDefault(); setDrag(i); }} style={{ cursor: 'grab' }}>
          <circle cx={x} cy={y} r={w / 30} fill={active === i ? '#ffd600' : '#00ff66'} fillOpacity={0.9} />
          <text x={x} y={y + w / 90} textAnchor="middle" fontSize={w / 30} fontWeight={800} fill="#000">{i + 1}</text>
        </g>
      ))}
      <text x={w / 2} y={h - h / 20} textAnchor="middle" fill="#888" fontSize={w / 40}>projector screen — drag a corner</text>
    </svg>
  );
}
