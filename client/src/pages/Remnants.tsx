/**
 * Remnants — leftover foam the shop keeps, and what can be cut from it.
 *
 *  /remnants      the rack: every usable leftover on file (saved automatically
 *                 when a slab is ticked off on the cut station, or scanned /
 *                 typed in here), grouped by foam. Scan = photo of the piece on
 *                 a contrasting floor → outline → scaled by one tape measurement.
 *  /remnants/:id  what fits: pieces still to be cut on open production lists
 *                 nested onto the remnant's real outline, plus every pattern of
 *                 that foam that would fit (cut ahead). Tick what you cut →
 *                 the list's slab plan drops those pieces and the remnant's own
 *                 leftovers go back on the rack.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { bbox, normalize, traceImage, type Poly } from '@/lib/shapes';
import { NestSheet, PieceThumb, makeColorMap, type PlacedPiece } from '@/components/foam/NestSheet';
import { Card, CardContent } from '@/components/ui/card';

const moLabel = (k?: string) => (k ?? '').replace(/^WH\/MO\//, 'MO ');
const sqft = (sqIn: number) => Math.round((sqIn / 144) * 10) / 10;

// ---------------------------------------------------------------------------
// Rack list
// ---------------------------------------------------------------------------
function Rack() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);
  const [foams, setFoams] = useState<any[]>([]);
  const [foamFilter, setFoamFilter] = useState<number | null>(null);
  const [showUsed, setShowUsed] = useState(false);
  const [adding, setAdding] = useState<'scan' | 'type' | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => Promise.all([api.getRemnants(), api.getFoams()]).then(([r, f]) => { setRows(r); setFoams(f.filter((x: any) => x.active !== false)); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => (rows ?? []).filter((r) => (showUsed || r.status === 'available') && (!foamFilter || r.foamId === foamFilter)), [rows, showUsed, foamFilter]);
  const byFoam = useMemo(() => {
    const m = new Map<number, { grade: string; thickness: number | null; items: any[]; sqIn: number }>();
    type Grp = { grade: string; thickness: number | null; items: any[]; sqIn: number };
    for (const r of visible) {
      const g: Grp = m.get(r.foamId) ?? { grade: r.foam.grade, thickness: r.foam.thicknessIn, items: [] as any[], sqIn: 0 };
      g.items.push(r);
      if (r.status === 'available') g.sqIn += r.areaSqIn;
      m.set(r.foamId, g);
    }
    return [...m.entries()].sort((a, b) => (b[1].thickness ?? 0) - (a[1].thickness ?? 0));
  }, [visible]);
  const available = (rows ?? []).filter((r) => r.status === 'available');

  const setStatus = async (r: any, status: string) => {
    try { await api.updateRemnant(r.id, { status }); await load(); } catch (e: any) { setErr(e.message); }
  };
  const remove = async (r: any) => {
    if (!confirm(`Delete ${r.tag} (${r.lengthIn}×${r.widthIn} ${r.foam.grade})?`)) return;
    try { await api.deleteRemnant(r.id); await load(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Remnants</h1>
          <p className="text-sm text-muted-foreground">Leftover foam worth keeping. Slabs ticked off on the cut station add their usable leftovers here automatically. Scan or type in anything else on the rack, then tap <b>Find cushions</b> to see what can be cut from it.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAdding('scan')} className="rounded-lg bg-emerald-600 px-5 py-3 text-base font-bold text-white hover:bg-emerald-500">📷 Scan a remnant</button>
          <button onClick={() => setAdding('type')} className="rounded-lg border px-5 py-3 text-base font-semibold hover:bg-accent">Type in a size</button>
          <Link to="/cut-station" className="rounded-lg border px-5 py-3 text-base font-semibold hover:bg-accent">Cut Station</Link>
        </div>
      </div>
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">{available.length}</div><div className="text-sm text-muted-foreground">remnants on the rack</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">{sqft(available.reduce((a, r) => a + r.areaSqIn, 0))} sq ft</div><div className="text-sm text-muted-foreground">of usable leftover foam</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">{Math.round(available.reduce((a, r) => a + r.boardFeet, 0))} BF</div><div className="text-sm text-muted-foreground">≈ ${Math.round(available.reduce((a, r) => a + r.boardFeet * (r.foam.costPerBoardFoot ?? 0), 0))} at slab cost</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFoamFilter(null)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${foamFilter === null ? 'bg-primary text-primary-foreground' : 'border'}`}>All foam</button>
        {foams.map((f) => {
          const n = available.filter((r) => r.foamId === f.id).length;
          return <button key={f.id} onClick={() => setFoamFilter(f.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${foamFilter === f.id ? 'bg-primary text-primary-foreground' : 'border'}`}>{f.grade} <span className="opacity-60">{n}</span></button>;
        })}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} /> show used / discarded</label>
      </div>

      {rows && !visible.length && <div className="rounded-lg border p-8 text-center text-muted-foreground">Nothing on the rack{foamFilter ? ' for that foam' : ''}. Tick a slab off on the cut station, or scan a remnant.</div>}

      {byFoam.map(([foamId, g]) => (
        <Card key={foamId}>
          <CardContent className="p-0">
            <div className="flex items-baseline justify-between border-b bg-muted/40 px-4 py-2">
              <div className="text-lg font-bold">{g.grade}</div>
              <div className="text-sm text-muted-foreground">{g.items.filter((r) => r.status === 'available').length} pieces · {sqft(g.sqIn)} sq ft</div>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((r) => (
                <div key={r.id} className={`flex gap-3 rounded-lg border p-3 ${r.status !== 'available' ? 'opacity-50' : ''}`}>
                  <PieceThumb poly={r.shape} l={r.lengthIn} w={r.widthIn} size={72} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black">{r.tag}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'available' ? 'bg-emerald-100 text-emerald-800' : r.status === 'used' ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-800'}`}>{r.status}</span>
                    </div>
                    <div className="text-lg font-semibold">{r.lengthIn}" × {r.widthIn}"{r.shapeType === 'polygon' ? ' (shaped)' : ''}</div>
                    <div className="truncate text-xs text-muted-foreground">{sqft(r.areaSqIn)} sq ft · {r.boardFeet} BF · {r.source === 'cut' ? (r.notes ?? 'left over from a cut') : r.source} · {new Date(r.createdAt).toLocaleDateString()}</div>
                    {r.status === 'available' ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button onClick={() => nav(`/remnants/${r.id}`)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-500">Find cushions</button>
                        <button onClick={() => setStatus(r, 'discarded')} className="rounded-md border px-2 py-1.5 text-xs hover:bg-accent" title="Thrown away / too small">Discard</button>
                        <button onClick={() => remove(r)} className="rounded-md border px-2 py-1.5 text-xs text-red-700 hover:bg-red-50" title="Not real — remove">✕</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {r.usedFor?.length ? <span>cut: {(r.usedFor as any[]).map((u) => `${u.qty}× ${u.label}`).join(', ')}</span> : null}
                        <button onClick={() => setStatus(r, 'available')} className="rounded-md border px-2 py-1 hover:bg-accent">Back on rack</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {adding && <AddRemnant mode={adding} foams={foams} onClose={() => setAdding(null)} onSaved={(m) => { setAdding(null); nav(`/remnants/${m.id}`); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan / type in a remnant
// ---------------------------------------------------------------------------
function AddRemnant({ mode, foams, onClose, onSaved }: { mode: 'scan' | 'type'; foams: any[]; onClose: () => void; onSaved: (m: any) => void }) {
  const [foamId, setFoamId] = useState<number>(foams[0]?.id ?? 0);
  const [L, setL] = useState('');
  const [W, setW] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tracePx, setTracePx] = useState<Poly | null>(null);
  const [traceDims, setTraceDims] = useState<{ w: number; h: number } | null>(null);
  const [longest, setLongest] = useState('');
  const [asRect, setAsRect] = useState(false);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setCamera(false); }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = s;
      setCamera(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } }, 50);
    } catch (e: any) { setMsg(`Camera not available: ${e.message}. Use "Take a photo" instead.`); }
  };
  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const im = new Image();
    im.onload = () => { stopCamera(); useImage(im); };
    im.src = c.toDataURL('image/jpeg', 0.92);
  };
  const useImage = (im: HTMLImageElement) => {
    setImg(im);
    try {
      const t = traceImage(im);
      setTracePx(t.poly); setTraceDims({ w: t.w, h: t.h });
      setMsg('Outline found. Measure the LONGEST side of the remnant with a tape and type it in.');
    } catch (e: any) { setTracePx(null); setTraceDims(null); setMsg(e.message); }
  };
  const onFile = (file: File) => {
    const im = new Image();
    im.onload = () => useImage(im);
    im.src = URL.createObjectURL(file);
  };

  // Pixel outline → inches, scaled so the longest bbox side equals the tape measurement.
  const scaled = useMemo(() => {
    if (!tracePx || !Number(longest)) return null;
    const b = bbox(tracePx);
    const k = Number(longest) / Math.max(b.w, b.h);
    const poly = normalize(tracePx.map(([x, y]) => [x * k, y * k] as [number, number]));
    const bb = bbox(poly);
    return { poly, l: Math.round(bb.w * 4) / 4, w: Math.round(bb.h * 4) / 4 };
  }, [tracePx, longest]);

  const save = async () => {
    setBusy(true);
    try {
      let m;
      if (mode === 'type') {
        if (!(Number(L) > 0 && Number(W) > 0)) throw new Error('Enter length and width in inches');
        m = await api.createRemnant({ foamId, lengthIn: Number(L), widthIn: Number(W) });
      } else {
        if (!scaled) throw new Error('Trace a photo and enter the longest side first');
        m = asRect ? await api.createRemnant({ foamId, lengthIn: scaled.l, widthIn: scaled.w }) : await api.createRemnant({ foamId, shape: scaled.poly });
      }
      onSaved(m);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const foam = foams.find((f) => f.id === foamId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{mode === 'scan' ? 'Scan a remnant' : 'Type in a remnant'}</h2>
            <p className="text-sm text-muted-foreground">{mode === 'scan' ? 'Lay the foam flat on a dark floor or table so the whole piece is in frame, nothing else light in the picture.' : 'Measure the piece as a rectangle (the biggest rectangle you could cut from it).'}</p>
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Close</button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
          <div>
            {mode === 'scan' && (
              <div className="space-y-3">
                {!img && !camera && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={startCamera} className="rounded-lg bg-emerald-600 px-5 py-4 text-lg font-bold text-white hover:bg-emerald-500">Use camera</button>
                    <label className="cursor-pointer rounded-lg border px-5 py-4 text-lg font-semibold hover:bg-accent">Take / upload a photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
                  </div>
                )}
                {camera && (
                  <div className="space-y-2">
                    <video ref={videoRef} playsInline muted className="w-full rounded-lg bg-black" />
                    <div className="flex gap-2"><button onClick={snap} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold text-white">📷 Snap</button><button onClick={stopCamera} className="rounded-lg border px-4 py-3">Cancel</button></div>
                  </div>
                )}
                {img && traceDims && (
                  <div className="relative">
                    <img src={img.src} alt="remnant" className="w-full rounded-lg" />
                    {tracePx && (
                      <svg viewBox={`0 0 ${traceDims.w} ${traceDims.h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                        <polygon points={(asRect ? (() => { const b = bbox(tracePx); return [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]] as Poly; })() : tracePx).map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth={traceDims.w / 250} />
                      </svg>
                    )}
                    <button onClick={() => { setImg(null); setTracePx(null); setTraceDims(null); setLongest(''); }} className="absolute right-2 top-2 rounded-md bg-black/60 px-3 py-1 text-sm text-white">Retake</button>
                  </div>
                )}
                {msg && <div className="rounded-md border bg-muted/40 p-2 text-sm">{msg}</div>}
              </div>
            )}
            {mode === 'type' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold">Length (in)<input type="number" step="0.25" value={L} onChange={(e) => setL(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-3 text-2xl" autoFocus /></label>
                <label className="text-sm font-semibold">Width (in)<input type="number" step="0.25" value={W} onChange={(e) => setW(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-3 text-2xl" /></label>
                {msg && <div className="col-span-2 rounded-md border bg-muted/40 p-2 text-sm">{msg}</div>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold">Which foam is it?
              <select value={foamId} onChange={(e) => setFoamId(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-background px-3 py-3 text-lg">
                {foams.map((f) => <option key={f.id} value={f.id}>{f.grade}{f.thicknessIn ? ` · ${f.thicknessIn}"` : ''}</option>)}
              </select>
            </label>
            {foam?.thicknessIn ? <div className="text-xs text-muted-foreground">Check the piece is really {foam.thicknessIn}" thick — the app trusts you on thickness.</div> : null}
            {mode === 'scan' && (
              <>
                <label className="block text-sm font-semibold">Longest side, measured (in)
                  <input type="number" step="0.25" value={longest} onChange={(e) => setLongest(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-3 text-2xl" disabled={!tracePx} />
                </label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asRect} onChange={(e) => setAsRect(e.target.checked)} /> Treat as a plain rectangle</label>
                {scaled && <div className="rounded-md border bg-emerald-50 p-3 text-emerald-900"><div className="text-2xl font-black">{scaled.l}" × {scaled.w}"</div><div className="text-xs">{tracePx?.length} outline points · {asRect ? 'rectangle' : 'traced shape'}</div></div>}
              </>
            )}
            <button onClick={save} disabled={busy || (mode === 'scan' && !scaled)} className="w-full rounded-lg bg-emerald-600 px-5 py-4 text-lg font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{busy ? 'Saving…' : 'Save & find cushions ▶'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match: what can be cut from this remnant
// ---------------------------------------------------------------------------
function Match({ id }: { id: number }) {
  const nav = useNavigate();
  const [rem, setRem] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [pickQty, setPickQty] = useState<Record<string, number>>({});
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [showLib, setShowLib] = useState(false);

  useEffect(() => {
    setErr('');
    Promise.all([api.getRemnant(id), api.matchRemnant(id)]).then(([r, m]) => {
      setRem(r); setMatch(m); setPlan(m.plan);
      setPickQty(Object.fromEntries(m.picks.map((p: any) => [`${p.orderId}|${p.label}|${p.mo ?? ''}`, p.qty])));
    }).catch((e) => setErr(e.message));
  }, [id]);

  const picks = useMemo(() => (match?.picks ?? []).map((p: any) => ({ ...p, qty: pickQty[`${p.orderId}|${p.label}|${p.mo ?? ''}`] ?? 0 })), [match, pickQty]);
  const extra = useMemo(() => (match?.libraryFits ?? []).map((f: any) => ({ skuId: f.skuId, piece: f.piece, label: `${f.code} ${f.piece}`, l: f.l, w: f.w, qty: extraQty[`${f.skuId}|${f.piece}`] ?? 0 })).filter((e: any) => e.qty > 0), [match, extraQty]);

  // Re-nest whenever the selection changes (debounced).
  const first = useRef(true);
  useEffect(() => {
    if (!match) return;
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { api.previewRemnant(id, picks, extra).then((r) => setPlan(r.plan)).catch((e) => setErr(e.message)); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickQty, extraQty]);

  const colors = useMemo(() => makeColorMap((plan?.sheets?.[0]?.pieces ?? []).map((p: PlacedPiece) => p.mo ?? p.label.split(' ')[0])), [plan]);
  const colorOf = useCallback((p: PlacedPiece) => colors.get(p.mo ?? p.label.split(' ')[0]) ?? '#10b981', [colors]);
  const sheet = plan?.sheets?.[0] ?? { index: 1, pieces: [], utilization: 0, remnants: [] };
  const placed = sheet.pieces.length;
  const wanted = picks.reduce((a: number, p: any) => a + p.qty, 0) + extra.reduce((a: number, e: any) => a + e.qty, 0);

  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.claimRemnant(id, picks.filter((p: any) => p.qty > 0), extra);
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">✓ {rem.tag} used</h1>
        <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-900">
          <div className="font-semibold">Cut from this remnant:</div>
          <ul className="mt-1 list-disc pl-5 text-sm">{(result.remnant.usedFor as any[]).map((u, i) => <li key={i}>{u.qty}× {u.label}{u.mo ? ` (${moLabel(u.mo)})` : ''}</li>)}</ul>
          {result.ordersUpdated?.length ? <div className="mt-2 text-sm">The slab plan for {result.ordersUpdated.length} production list{result.ordersUpdated.length > 1 ? 's' : ''} was rebuilt without these pieces.</div> : null}
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold">Left over — back on the rack:</div>
          {result.leftovers?.length ? <ul className="mt-1 list-disc pl-5 text-sm">{result.leftovers.map((m: any) => <li key={m.id}><b>R-{m.id}</b> {m.lengthIn}" × {m.widthIn}"</li>)}</ul> : <div className="text-sm text-muted-foreground">Nothing worth keeping (under 6" or under 1 sq ft).</div>}
        </div>
        <div className="flex gap-2">
          <Link to="/remnants" className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white">Back to the rack</Link>
          {result.ordersUpdated?.[0] && <Link to={`/cut-station/${result.ordersUpdated[0]}`} className="rounded-lg border px-5 py-3 font-semibold">Open the cut station</Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/remnants" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-accent">◀ Rack</Link>
          <div>
            <h1 className="text-2xl font-bold">{rem?.tag ?? '…'} · {rem?.foam?.grade}</h1>
            <div className="text-sm text-muted-foreground">{rem ? `${rem.lengthIn}" × ${rem.widthIn}"${rem.shapeType === 'polygon' ? ' shaped' : ''} · ${sqft(rem.areaSqIn)} sq ft` : ''}{rem?.notes ? ` · ${rem.notes}` : ''}</div>
          </div>
        </div>
        {match && <div className="text-right text-sm text-muted-foreground">{match.openCount} pieces of this foam still to cut on open lists</div>}
      </div>
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border bg-white p-2" style={{ minHeight: 360 }}>
          {rem && <NestSheet sheet={sheet} length={rem.lengthIn} width={rem.widthIn} colorOf={colorOf} stockPoly={rem.shape} caption={`${rem.tag} remnant ${rem.lengthIn}" × ${rem.widthIn}" · ${placed} piece${placed === 1 ? '' : 's'} · ${Math.round((sheet.utilization ?? 0) * 100)}% used`} big />}
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Needed now on open lists — tick what you will cut</div>
          {match && !match.picks.length && <div className="rounded-md border p-3 text-sm text-muted-foreground">{match.openCount ? 'None of the open-list pieces for this foam fit on this remnant.' : 'No open production list needs this foam right now.'} Try the patterns below to cut ahead.</div>}
          {picks.map((p: any) => {
            const key = `${p.orderId}|${p.label}|${p.mo ?? ''}`;
            const max = match.picks.find((x: any) => `${x.orderId}|${x.label}|${x.mo ?? ''}` === key)?.qty ?? 0;
            return (
              <div key={key} className={`flex items-center gap-3 rounded-lg border p-3 ${p.qty ? 'border-emerald-400 bg-emerald-50/50' : 'opacity-60'}`} style={{ borderLeft: `6px solid ${colors.get(p.mo ?? p.label.split(' ')[0]) ?? '#ccc'}` }}>
                <input type="checkbox" className="h-6 w-6" checked={p.qty > 0} onChange={(e) => setPickQty({ ...pickQty, [key]: e.target.checked ? max : 0 })} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{moLabel(p.mo)} · {p.scheduleNumber ? `List ${p.scheduleNumber}` : p.orderName} · {p.l}×{p.w}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPickQty({ ...pickQty, [key]: Math.max(0, p.qty - 1) })} className="h-8 w-8 rounded border text-lg">−</button>
                  <span className="w-10 text-center text-lg font-black">{p.qty}<span className="text-xs text-muted-foreground">/{max}</span></span>
                  <button onClick={() => setPickQty({ ...pickQty, [key]: Math.min(max, p.qty + 1) })} className="h-8 w-8 rounded border text-lg">+</button>
                </div>
              </div>
            );
          })}

          <button onClick={() => setShowLib((v) => !v)} className="w-full rounded-md border px-3 py-2 text-left text-sm font-semibold hover:bg-accent">{showLib ? '▾' : '▸'} Cut ahead: any {rem?.foam?.grade} pattern that fits ({match?.libraryFits?.length ?? 0})</button>
          {showLib && (
            <div className="max-h-80 space-y-1 overflow-auto rounded-md border p-2">
              {(match?.libraryFits ?? []).map((f: any) => {
                const key = `${f.skuId}|${f.piece}`;
                const q = extraQty[key] ?? 0;
                return (
                  <div key={key} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${q ? 'bg-emerald-50' : ''}`}>
                    <PieceThumb l={f.l} w={f.w} size={28} />
                    <div className="min-w-0 flex-1 truncate"><b>{f.code}</b> {f.piece} <span className="text-xs text-muted-foreground">{f.l}×{f.w}{f.shaped ? ' shaped' : ''} · up to {f.maxQty}</span></div>
                    <button onClick={() => setExtraQty({ ...extraQty, [key]: Math.max(0, q - 1) })} className="h-7 w-7 rounded border">−</button>
                    <span className="w-6 text-center font-bold">{q}</span>
                    <button onClick={() => setExtraQty({ ...extraQty, [key]: Math.min(f.maxQty, q + 1) })} className="h-7 w-7 rounded border">+</button>
                  </div>
                );
              })}
              {match && !match.libraryFits.length && <div className="p-2 text-xs text-muted-foreground">No pattern of this foam fits on this remnant.</div>}
            </div>
          )}

          {placed < wanted && plan?.unplaced?.length ? <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Doesn't fit with the rest: {[...new Set(plan.unplaced.map((u: any) => u.label))].join(', ')}. Untick something or lower a quantity.</div> : null}

          <div className="sticky bottom-2 space-y-2 pt-2">
            <button onClick={claim} disabled={busy || !placed || placed < wanted} className="w-full rounded-lg bg-emerald-600 px-5 py-4 text-lg font-black text-white hover:bg-emerald-500 disabled:opacity-40">{busy ? 'Saving…' : `I cut these ${placed} piece${placed === 1 ? '' : 's'} from ${rem?.tag ?? ''} ✓`}</button>
            <div className="flex gap-2">
              <button onClick={async () => { try { await api.updateRemnant(id, { status: 'discarded' }); nav('/remnants'); } catch (e: any) { setErr(e.message); } }} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent">Discard remnant</button>
              <button onClick={async () => { try { await api.updateRemnant(id, { status: 'used' }); nav('/remnants'); } catch (e: any) { setErr(e.message); } }} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent">Used for something else</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Remnants() {
  const { id } = useParams();
  return id ? <Match id={Number(id)} /> : <Rack />;
}
