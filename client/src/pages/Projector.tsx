/**
 * Projector display — open this page in a browser on the PC driving the
 * projector over the cutting table, drag it onto the projector screen and press
 * F for full screen. It follows the shared station state:
 *
 *   slab       the slab the cut station is on, drawn through the table
 *              calibration for that foam's thickness so the outlines land on
 *              the real slab (the operator marks along the light, or cuts on it)
 *   calibrate  four numbered crosshairs the tablet nudges onto the corners of a
 *              reference slab (drag them with the mouse here too; arrow keys
 *              move the highlighted one)
 *   grid       a 6" grid over the reference rectangle (alignment check)
 *   idle       black
 *
 * If a USB camera is on this PC, turn on "station camera" (C): the page then
 * answers snapshot requests from the tablet (slab measurement, camera
 * calibration). Keys: F full screen · H hide panel · C station camera.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { applyH, cornersAt, fitCorners, localScale, refCorners, solveHomography, type Calibration, type Pt } from '@/lib/homography';
import { makeColorMap, type PlacedPiece } from '@/components/foam/NestSheet';

const keyOf = (p: PlacedPiece) => p.mo ?? p.label.split(' ')[0];
const moLabel = (k?: string) => (k ?? '').replace(/^WH\/MO\//, 'MO ');
function centroid(poly: Pt[]): Pt {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; const f = x1 * y2 - x2 * y1; cx += (x1 + x2) * f; cy += (y1 + y2) * f; a += f; }
  if (Math.abs(a) < 1e-9) return poly[0];
  return [cx / (3 * a), cy / (3 * a)];
}

export default function Projector() {
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [station, setStation] = useState<{ state: any; calibration: Calibration | null; prefs: any } | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [panel, setPanel] = useState(true);
  const [cameraOn, setCameraOn] = useState(() => { try { return localStorage.getItem('station-camera') === '1'; } catch { return false; } });
  const [camMsg, setCamMsg] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const orderRef = useRef<{ id: number; updatedAt: string } | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localCorners = useRef<Pt[] | null>(null); // corners being dragged here, ahead of the server

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Follow the shared state.
  const poll = useCallback(async () => {
    try {
      const s = await api.getStation();
      setStation(s);
      const st = s.state ?? {};
      if (st.mode === 'slab' && st.orderId) {
        // Refetch the order when it changes (re-nest, remnant claim, measured slab).
        const o = await api.getFoamOrder(st.orderId).catch(() => null);
        if (o && (!orderRef.current || orderRef.current.id !== o.id || orderRef.current.updatedAt !== o.updatedAt)) { orderRef.current = { id: o.id, updatedAt: o.updatedAt }; setOrder(o); }
      }
      // In calibrate mode with no corners yet, seed them from this screen.
      if (st.mode === 'calibrate' && st.calibrate && !st.calibrate.corners && s.calibration) {
        const c = fitCorners(s.calibration.refLengthIn, s.calibration.refWidthIn, window.innerWidth, window.innerHeight);
        await api.setStationState({ calibrate: { ...st.calibrate, corners: c, screenW: window.innerWidth, screenH: window.innerHeight } });
      }
      if (st.mode !== 'calibrate') localCorners.current = null;
    } catch { /* keep last picture */ }
  }, []);
  useEffect(() => { poll(); const t = setInterval(poll, 1000); return () => clearInterval(t); }, [poll]);

  // Station camera agent.
  useEffect(() => {
    if (!cameraOn) { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setCamMsg(''); return; }
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
        setCamMsg('station camera on');
      } catch (e: any) { setCamMsg(`camera: ${e.message}`); }
    })();
    const t = setInterval(async () => {
      try {
        await api.pingCameraAgent();
        const req = await api.pollSnapshotRequest();
        if (req && videoRef.current && videoRef.current.videoWidth) {
          const v = videoRef.current;
          const c = document.createElement('canvas');
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d')!.drawImage(v, 0, 0);
          await api.uploadSnapshot({ id: req.id, jpeg: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height });
          setCamMsg(`snapshot sent ${new Date().toLocaleTimeString()}`);
        }
      } catch { /* retry next tick */ }
    }, 1000);
    return () => { alive = false; clearInterval(t); streamRef.current?.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; };
  }, [cameraOn]);

  const state = station?.state ?? { mode: 'idle' };
  const cal = station?.calibration ?? null;
  const prefs = station?.prefs ?? { lineWidth: 3, color: '#00ff66', colorMode: 'mo', showLabels: true, labelSize: 22, showOutline: true };
  const L = cal?.refLengthIn ?? 82, W = cal?.refWidthIn ?? 36;

  // Projector corners were saved for a screen size; scale if this window differs.
  const scaleCorners = useCallback((c: Pt[] | null, sw?: number, sh?: number): Pt[] | null => {
    if (!c) return null;
    if (!sw || !sh || (sw === win.w && sh === win.h)) return c;
    return c.map(([x, y]) => [x * (win.w / sw), y * (win.h / sh)] as Pt);
  }, [win]);

  // --- slab mode data
  const slab = useMemo(() => {
    if (state.mode !== 'slab' || !order || !state.slabKey) return null;
    const [foamIdS, idxS] = String(state.slabKey).split('-');
    const foamId = Number(foamIdS), idx = Number(idxS);
    const plan = order.cutPlan?.[foamId];
    const sheet = plan?.sheets?.find((s: any) => s.index === idx);
    if (!plan || !sheet) return null;
    const req = (order.requirements ?? []).find((r: any) => r.foamId === foamId);
    return { foamId, sheet, plan, grade: req?.grade ?? '', thickness: req?.thicknessIn ?? 0, length: sheet.stock?.length ?? plan.sheetLength, width: sheet.stock?.width ?? plan.sheetWidth, offX: sheet.stock?.x ?? 0, offY: sheet.stock?.y ?? 0 };
  }, [state, order]);

  const H = useMemo(() => {
    const t = slab?.thickness ?? (state.gridThickness ?? 0);
    const c = scaleCorners(cornersAt(cal?.projector, t), cal?.projector?.screenW, cal?.projector?.screenH) ?? fitCorners(L, W, win.w, win.h);
    return solveHomography(refCorners(L, W), c as [Pt, Pt, Pt, Pt]);
  }, [slab, state.gridThickness, cal, L, W, win, scaleCorners]);

  const colors = useMemo(() => {
    const keys: string[] = [];
    for (const r of order?.requirements ?? []) for (const s of order.cutPlan?.[r.foamId]?.sheets ?? []) for (const p of s.pieces) keys.push(keyOf(p));
    return makeColorMap(keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  }, [order]);
  const colorOf = (p: PlacedPiece) => (prefs.colorMode === 'single' ? prefs.color : colors.get(keyOf(p)) ?? prefs.color);

  const P = (pt: Pt): Pt => applyH(H, [pt[0] + (slab?.offX ?? 0), pt[1] + (slab?.offY ?? 0)]);
  const pts = (poly: Pt[]) => poly.map((q) => P(q)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const rectPoly = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  // --- calibrate mode: corners live on the server; drag here too
  const calCorners: Pt[] | null = state.mode === 'calibrate' ? (localCorners.current ?? scaleCorners(state.calibrate?.corners ?? null, state.calibrate?.screenW, state.calibrate?.screenH)) : null;
  const pushCorners = (c: Pt[]) => {
    localCorners.current = c;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => { api.setStationState({ calibrate: { ...(state.calibrate ?? {}), corners: c, screenW: win.w, screenH: win.h } }).catch(() => {}); }, 120);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag === null || !calCorners) return;
    const c = calCorners.map((q, i) => (i === drag ? ([e.clientX, e.clientY] as Pt) : q));
    pushCorners(c);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
      if (e.key === 'h' || e.key === 'H') setPanel((v) => !v);
      if (e.key === 'c' || e.key === 'C') setCameraOn((v) => { try { localStorage.setItem('station-camera', v ? '0' : '1'); } catch { /* ignore */ } return !v; });
      if (state.mode === 'calibrate' && calCorners && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const i = state.calibrate?.active ?? 0;
        const step = e.shiftKey ? 10 : 1;
        const d: Record<string, Pt> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        pushCorners(calCorners.map((q, k) => (k === i ? ([q[0] + d[e.key][0], q[1] + d[e.key][1]] as Pt) : q)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, calCorners]);

  const lw = prefs.lineWidth ?? 3;
  const outline: Pt[] = slab?.sheet.stock?.poly ?? rectPoly(0, 0, slab?.length ?? L, slab?.width ?? W);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white" onPointerMove={onMove} onPointerUp={() => setDrag(null)} style={{ cursor: state.mode === 'calibrate' ? 'crosshair' : 'default' }}>
      <video ref={videoRef} muted playsInline className="hidden" />
      <svg width={win.w} height={win.h} className="absolute inset-0">
        {/* ---- slab ---- */}
        {state.mode === 'slab' && slab && (
          <g>
            {prefs.showOutline && <polygon points={pts(outline)} fill="none" stroke="#ffffff" strokeWidth={lw * 0.7} strokeDasharray={`${lw * 4} ${lw * 3}`} opacity={0.8} />}
            {(slab.sheet.pieces as PlacedPiece[]).map((p, i) => {
              const poly = p.poly ?? rectPoly(p.x, p.y, p.w, p.h);
              const c = colorOf(p);
              const [cx, cy] = centroid(poly);
              const [sx, sy] = P([cx, cy]);
              const scale = localScale(H, [cx, cy]);
              const fs = Math.max(10, Math.min(prefs.labelSize ?? 22, Math.min(p.w, p.h) * scale * 0.22));
              const mo = p.mo ? moLabel(p.mo) : null;
              return (
                <g key={i}>
                  <polygon points={pts(poly)} fill={c} fillOpacity={0.06} stroke={c} strokeWidth={lw} strokeLinejoin="round" />
                  {p.glue && <line x1={P([p.glue.seam[0], p.glue.seam[1]])[0]} y1={P([p.glue.seam[0], p.glue.seam[1]])[1]} x2={P([p.glue.seam[2], p.glue.seam[3]])[0]} y2={P([p.glue.seam[2], p.glue.seam[3]])[1]} stroke="#ff3b30" strokeWidth={lw * 1.3} strokeDasharray={`${lw * 3} ${lw * 2}`} />}
                  {prefs.showLabels && (
                    <g fontFamily="system-ui, sans-serif" textAnchor="middle" fill="#fff">
                      <text x={sx} y={sy - (mo ? fs * 0.35 : 0)} fontSize={fs} fontWeight={800}>{p.label.split(' ')[0]}</text>
                      {mo && <text x={sx} y={sy + fs * 0.75} fontSize={fs * 0.85} fontWeight={700} fill={c}>{mo}</text>}
                      <text x={sx} y={sy + fs * (mo ? 1.55 : 0.9)} fontSize={fs * 0.6} fill="#ddd">{p.label.split(' ').slice(1).join(' ')} · {p.w}×{p.h}{p.glue ? ` · GLUE ${p.glue.part}` : ''}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}
        {/* ---- 6" grid ---- */}
        {state.mode === 'grid' && (
          <g stroke="#00ff66" strokeWidth={lw * 0.6} fill="none">
            <polygon points={pts(rectPoly(0, 0, L, W))} strokeWidth={lw} />
            {Array.from({ length: Math.floor(L / 6) }, (_, i) => <polyline key={`x${i}`} points={pts([[(i + 1) * 6, 0], [(i + 1) * 6, W]])} opacity={(i + 1) % 2 ? 0.5 : 1} />)}
            {Array.from({ length: Math.floor(W / 6) }, (_, i) => <polyline key={`y${i}`} points={pts([[0, (i + 1) * 6], [L, (i + 1) * 6]])} opacity={(i + 1) % 2 ? 0.5 : 1} />)}
            {[[0, 0, 'TL 0,0'], [L, 0, `TR ${L},0`], [L, W, `BR ${L},${W}`], [0, W, `BL 0,${W}`]].map(([x, y, t], i) => { const [sx, sy] = P([Number(x), Number(y)]); return <text key={i} x={sx} y={sy - 8} fill="#fff" fontSize={18} textAnchor="middle" stroke="none">{t}</text>; })}
          </g>
        )}
        {/* ---- calibration crosshairs ---- */}
        {state.mode === 'calibrate' && calCorners && (
          <g>
            <polygon points={calCorners.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#00ff66" strokeWidth={1.5} strokeDasharray="8 6" opacity={0.7} />
            {calCorners.map(([x, y], i) => {
              const active = (state.calibrate?.active ?? 0) === i;
              const c = active ? '#ffd600' : '#00ff66';
              return (
                <g key={i} onPointerDown={(e) => { e.preventDefault(); setDrag(i); }} style={{ cursor: 'grab' }}>
                  <circle cx={x} cy={y} r={28} fill="transparent" />
                  <line x1={x - 40} y1={y} x2={x + 40} y2={y} stroke={c} strokeWidth={2} />
                  <line x1={x} y1={y - 40} x2={x} y2={y + 40} stroke={c} strokeWidth={2} />
                  <circle cx={x} cy={y} r={14} fill="none" stroke={c} strokeWidth={2} />
                  <text x={x + 18} y={y - 18} fill={c} fontSize={26} fontWeight={800}>{i + 1}</text>
                  <text x={x + 18} y={y + 34} fill="#aaa" fontSize={12}>{['top-left (0,0)', `top-right (${L},0)`, `bottom-right (${L},${W})`, `bottom-left (0,${W})`][i]}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* status panel (H to hide) */}
      {panel && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur">
          <div className="font-bold text-white">Foam projector · {win.w}×{win.h}{document.fullscreenElement ? '' : ' · press F for full screen'}</div>
          <div>
            {state.mode === 'slab' && slab ? `${order?.name} · ${slab.grade} slab ${slab.sheet.index} · ${slab.length}×${slab.width}${slab.sheet.stock ? ' measured' : ''} · ${slab.sheet.pieces.length} pieces` : null}
            {state.mode === 'slab' && !slab ? 'Waiting for a slab from the cut station…' : null}
            {state.mode === 'calibrate' ? `Calibrating plane ${state.calibrate?.thicknessIn ?? '?'}" — drag crosshairs or use arrow keys (Shift = 10 px); corner ${(state.calibrate?.active ?? 0) + 1} selected` : null}
            {state.mode === 'grid' ? `6" grid at ${state.gridThickness ?? 0}" plane` : null}
            {state.mode === 'idle' ? 'Idle — controlled from the cut station / Projector & camera page' : null}
          </div>
          <div className="mt-1 text-white/60">
            {cal?.projector?.planes?.length ? `${cal.projector.planes.length} projector plane${cal.projector.planes.length > 1 ? 's' : ''} calibrated` : 'NOT CALIBRATED — using a fitted rectangle'}
            {' · '}<button className="underline" onClick={() => setCameraOn((v) => { try { localStorage.setItem('station-camera', v ? '0' : '1'); } catch { /* ignore */ } return !v; })}>station camera {cameraOn ? 'ON' : 'off'} (C)</button>{camMsg ? ` · ${camMsg}` : ''}
            {' · H hides this'}
          </div>
        </div>
      )}
    </div>
  );
}
