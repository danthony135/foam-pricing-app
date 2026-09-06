/**
 * Cut Station — the foam cutter's screen.
 *
 *  1. /cut-station        pick the production list you are working from
 *                         (FurnitureSuite schedules = Odoo MOs on that list)
 *  2. /cut-station/:id    one slab at a time, to scale, big labels; lay the
 *                         cardboard templates as pictured, cut, tick the slab.
 *
 * Every piece carries its MO number and is coloured by production order, so
 * the cut foam can be bundled per order straight off the slab. The slab is
 * drawn with its long side across the screen (auto by screen shape, or use the
 * Rotate button). Progress is saved on the server so a TV, a tablet and the
 * office all agree. Keys: → / space next · ← prev · Enter mark cut · R rotate
 * · 1-9 jump to a foam thickness · 0 all foam.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { NestSheet, makeColorMap, type PlacedPiece } from '@/components/foam/NestSheet';

const keyOf = (p: PlacedPiece) => p.mo ?? p.label.split(' ')[0];
const moLabel = (k: string) => k.replace(/^WH\/MO\//, 'MO ');

// ---------------------------------------------------------------------------
// Screen 1: list picker
// ---------------------------------------------------------------------------
function ListPicker() {
  const nav = useNavigate();
  const [lists, setLists] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => api.getSchedules().then(setLists).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const open = async (l: any) => {
    setBusy(l.scheduleNumber);
    try {
      const r = await api.buildScheduleOrder(l.scheduleNumber);
      nav(`/cut-station/${r.order.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Foam cut station</div>
          <h1 className="text-3xl font-black">Which production list are you working from?</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <button onClick={load} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold hover:bg-slate-700">Refresh</button>
          <Link to="/" className="hover:text-white">Office view</Link>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {err && <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">{err}</div>}
        {!lists && !err && <div className="text-2xl text-slate-400">Loading production lists from Odoo…</div>}
        {lists && !lists.length && <div className="text-2xl text-slate-400">No open production lists right now.</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(lists ?? []).map((l) => {
            const pct = l.slabs ? Math.round((l.slabsDone / l.slabs) * 100) : 0;
            const done = l.status === 'cut' || (l.slabs > 0 && l.slabsDone >= l.slabs);
            return (
              <button
                key={l.scheduleNumber}
                onClick={() => open(l)}
                disabled={busy !== null}
                className={`flex flex-col rounded-2xl border-2 p-5 text-left transition active:scale-[0.99] ${done ? 'border-emerald-600 bg-emerald-950/40' : l.orderId ? 'border-orange-500 bg-slate-900' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-5xl font-black">List {l.scheduleNumber}</span>
                  {done && <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold">CUT ✓</span>}
                  {!done && l.orderId && <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold">IN PROGRESS</span>}
                </div>
                <div className="mt-2 text-lg text-slate-300">{l.moCount} orders · {l.pieces} pieces</div>
                <div className="mt-1 text-sm text-slate-400">{l.withPattern}/{l.moCount} with a foam pattern{l.mapped < l.moCount ? ` · ${l.moCount - l.mapped} not foam` : ''}</div>
                {l.slabs > 0 && (
                  <div className="mt-3">
                    <div className="h-2 w-full rounded bg-slate-800"><div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-1 text-xs text-slate-400">{l.slabsDone}/{l.slabs} slabs cut</div>
                  </div>
                )}
                <div className="mt-3 line-clamp-2 text-xs text-slate-500">{l.products.join(' · ')}</div>
                {busy === l.scheduleNumber && <div className="mt-3 text-sm text-orange-400">Building cut list & nesting…</div>}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 2: slab by slab
// ---------------------------------------------------------------------------
function SlabView({ orderId }: { orderId: number }) {
  const [o, setO] = useState<any>(null);
  const [i, setI] = useState(0);
  const [foamFilter, setFoamFilter] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showList, setShowList] = useState(false);
  const [rotatePref, setRotatePref] = useState<'auto' | 'on' | 'off'>(() => { try { return (localStorage.getItem('cut-rotate') as any) || 'auto'; } catch { return 'auto'; } });
  const [portrait, setPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = useCallback(async () => {
    const x = await api.getFoamOrder(orderId);
    setO(x);
    setDone(new Set(x.cutProgress?.done ?? []));
  }, [orderId]);
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);

  const foams = useMemo(() => (o?.requirements ?? []).map((r: any) => ({ id: r.foamId, grade: r.grade, thickness: r.thicknessIn, slabs: o.cutPlan?.[r.foamId]?.sheets?.length ?? 0 })), [o]);
  const slabs = useMemo(() => {
    if (!o) return [] as any[];
    const out: any[] = [];
    for (const r of o.requirements ?? []) {
      if (foamFilter && r.foamId !== foamFilter) continue;
      const plan = o.cutPlan?.[r.foamId];
      if (!plan) continue;
      for (const s of plan.sheets) out.push({ key: `${r.foamId}-${s.index}`, grade: r.grade, foamId: r.foamId, sheet: s, length: plan.sheetLength, width: plan.sheetWidth, total: plan.sheets.length });
    }
    return out;
  }, [o, foamFilter]);
  // Colour per production order across the whole list (stable from slab to slab).
  const colors = useMemo(() => {
    const keys: string[] = [];
    for (const r of o?.requirements ?? []) for (const s of o.cutPlan?.[r.foamId]?.sheets ?? []) for (const p of s.pieces) keys.push(keyOf(p));
    // Order colours by MO name so neighbours on the list get distinct hues.
    return makeColorMap(keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  }, [o]);
  const colorOf = useCallback((p: PlacedPiece) => colors.get(keyOf(p)) ?? '#f97316', [colors]);
  const productByMo = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of (o?.lines ?? []) as any[]) if (l.moName) m[l.moName] = `${l.code} ×${l.qty}`;
    return m;
  }, [o]);
  const totalSlabs = useMemo(() => foams.reduce((a: number, f: any) => a + f.slabs, 0), [foams]);
  const cur = slabs[Math.min(i, Math.max(0, slabs.length - 1))];

  // Long side across the wider screen dimension unless the operator overrides.
  const slabLandscape = cur ? cur.length >= cur.width : true;
  const rotate = rotatePref === 'on' ? true : rotatePref === 'off' ? false : portrait === slabLandscape;
  const cycleRotate = () => {
    const next = rotatePref === 'auto' ? (rotate ? 'off' : 'on') : rotatePref === 'on' ? 'off' : 'on';
    setRotatePref(next);
    try { localStorage.setItem('cut-rotate', next); } catch { /* ignore */ }
  };

  useEffect(() => {
    const first = slabs.findIndex((s) => !done.has(s.key));
    setI(first >= 0 ? first : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foamFilter, o]);

  const persist = async (n: Set<string>) => {
    setSaving(true);
    try { await api.saveCutProgress(orderId, [...n]); } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };
  const markDone = useCallback(() => {
    if (!cur) return;
    const n = new Set(done);
    const wasDone = n.has(cur.key);
    wasDone ? n.delete(cur.key) : n.add(cur.key);
    setDone(n);
    persist(n);
    if (!wasDone) {
      const next = slabs.findIndex((s, j) => j > i && !n.has(s.key));
      if (next >= 0) setI(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, done, slabs, i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setI((x) => Math.min(slabs.length - 1, x + 1)); }
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      if (e.key === 'Enter') markDone();
      if (e.key === 'r' || e.key === 'R') cycleRotate();
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && foams[n - 1]) setFoamFilter(foams[n - 1].id);
      if (e.key === '0') setFoamFilter(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slabs.length, markDone, foams, rotatePref, rotate]);

  const refresh = async () => {
    setSaving(true);
    try { await api.optimizeFoamOrder(orderId); await load(); } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  // Pieces on this slab grouped by production order, then by piece.
  const moGroups = useMemo(() => {
    if (!cur) return [] as { key: string; pieces: { label: string; n: number; w: number; h: number }[] }[];
    const byMo = new Map<string, Map<string, { label: string; n: number; w: number; h: number }>>();
    for (const p of cur.sheet.pieces as PlacedPiece[]) {
      const k = keyOf(p);
      const g = byMo.get(k) ?? new Map();
      const e = g.get(p.label) ?? { label: p.label, n: 0, w: p.w, h: p.h };
      e.n++;
      g.set(p.label, e);
      byMo.set(k, g);
    }
    return [...byMo.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([key, g]) => ({ key, pieces: [...g.values()] }));
  }, [cur]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-2">
        <div className="flex items-center gap-4">
          <Link to="/cut-station" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700">◀ Lists</Link>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">Production list</div>
            <div className="text-2xl font-black">{o?.name ?? '…'}</div>
          </div>
          <div className="ml-4 flex flex-wrap gap-2">
            <button onClick={() => setFoamFilter(null)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${foamFilter === null ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'}`}>All foam</button>
            {foams.map((f: any, idx: number) => {
              const d = [...done].filter((k) => k.startsWith(`${f.id}-`)).length;
              return (
                <button key={f.id} onClick={() => setFoamFilter(f.id)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${foamFilter === f.id ? 'bg-white text-slate-900' : d >= f.slabs && f.slabs ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'}`}>
                  <span className="mr-1 text-xs opacity-60">{idx + 1}</span>{f.grade} · {d}/{f.slabs}
                </button>
              );
            })}
          </div>
        </div>
        {cur && (
          <div className="text-right">
            <div className="text-3xl font-black">{cur.grade}</div>
            <div className="text-sm text-slate-400">Slab {cur.sheet.index} of {cur.total} · {cur.length}" × {cur.width}" · {cur.sheet.pieces.length} pieces · {done.size}/{totalSlabs} slabs cut{saving ? ' · saving…' : ''}</div>
          </div>
        )}
      </header>

      <main className="flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden p-3">
        {err && <div className="m-auto rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-lg">{err}</div>}
        {!err && o && !slabs.length && (
          <div className="m-auto max-w-xl text-center">
            <div className="text-2xl text-slate-300">Nothing to cut on this list{foamFilter ? ' for that foam' : ''}.</div>
            {o.notes && <div className="mt-3 text-sm text-slate-500">{o.notes}</div>}
            {!o.requirements?.length && <div className="mt-3 text-sm text-slate-500">The SKUs on this list have no foam pattern yet. Enter them under SKUs & Patterns, then press Refresh.</div>}
          </div>
        )}
        {cur && (
          <>
            <div className={`flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-xl ${done.has(cur.key) ? 'ring-4 ring-emerald-500' : ''}`}>
              <NestSheet sheet={cur.sheet} length={cur.length} width={cur.width} colorOf={colorOf} big rotate={rotate} />
            </div>
            <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-auto">
              <div className="text-xs uppercase tracking-wide text-slate-400">On this slab, by production order</div>
              {(cur.sheet.pieces as PlacedPiece[]).some((p) => p.glue) && (
                <div className="rounded-md border border-red-500/60 bg-red-950/40 p-2 text-sm">
                  <div className="font-bold text-red-300">Glue-ups on this slab</div>
                  {(cur.sheet.pieces as PlacedPiece[]).filter((p) => p.glue).map((p, k) => (
                    <div key={k}>{p.label} — part {p.glue!.part} of {p.glue!.wholeL}×{p.glue!.wholeW}{p.glue!.mateSlab ? `, mate on slab ${p.glue!.mateSlab}` : ''}</div>
                  ))}
                  <div className="mt-1 text-xs text-red-200/80">One seam only. Glue the two parts along the dashed edge before wrapping.</div>
                </div>
              )}
              {moGroups.map((g) => (
                <div key={g.key} className="rounded-md bg-slate-900 p-2" style={{ borderLeft: `6px solid ${colors.get(g.key) ?? '#f97316'}` }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black">{moLabel(g.key)}</span>
                    <span className="text-xs text-slate-400">{productByMo[g.key] ?? ''}</span>
                  </div>
                  {g.pieces.map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-sm">
                      <span><b>{p.label.split(' ')[0]}</b> {p.label.split(' ').slice(1).join(' ')}</span>
                      <span className="text-slate-300">{p.n}× <span className="text-xs text-slate-500">{p.w}×{p.h}</span></span>
                    </div>
                  ))}
                </div>
              ))}
              {cur.sheet.remnants?.length ? (
                <div className="rounded-md bg-slate-900 p-2 text-xs text-slate-400">Scrap left: {Math.round((cur.sheet.scrapSqIn ?? 0) / 144 * 10) / 10} sq ft · usable {cur.sheet.remnants.map((m: any) => `${m.w}×${m.h}`).join(', ')}</div>
              ) : null}
              <button onClick={() => setShowList((v) => !v)} className="mt-auto rounded-md bg-slate-900 px-3 py-2 text-left text-xs text-slate-400 hover:text-white">{showList ? 'Hide' : 'Show'} whole list ({(o?.lines ?? []).length} orders)</button>
              {showList && (
                <div className="max-h-48 overflow-auto rounded-md bg-slate-900 p-2 text-xs text-slate-300">
                  {(o.lines as any[]).map((l, k) => <div key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: colors.get(l.moName ?? l.code) ?? '#555' }} />{moLabel(l.moName ?? '')} · <b>{l.code}</b> ×{l.qty}</div>)}
                </div>
              )}
            </aside>
          </>
        )}
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
        <button className="rounded-lg bg-slate-800 px-6 py-4 text-xl font-bold disabled:opacity-30" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0 || !slabs.length}>◀ Prev</button>
        <div className="flex flex-1 flex-wrap justify-center gap-1">
          {slabs.map((s, j) => (
            <button key={s.key} onClick={() => setI(j)} className={`h-4 w-7 rounded-sm ${j === i ? 'bg-orange-500' : done.has(s.key) ? 'bg-emerald-500' : 'bg-slate-700'}`} title={`${s.grade} slab ${s.sheet.index}`} />
          ))}
        </div>
        <button className="rounded-lg bg-slate-800 px-4 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-700" onClick={cycleRotate} title="R">{rotate ? '⟲ Rotate' : '⟳ Rotate'}{rotatePref === 'auto' ? ' (auto)' : ''}</button>
        <button className="rounded-lg bg-slate-800 px-4 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-700" onClick={refresh} disabled={saving}>Refresh from Odoo</button>
        <button className={`rounded-lg px-8 py-4 text-xl font-black ${cur && done.has(cur.key) ? 'bg-emerald-800' : 'bg-emerald-600'} disabled:opacity-30`} onClick={markDone} disabled={!cur}>{cur && done.has(cur.key) ? '✓ Cut (undo)' : 'Mark slab cut ✓'}</button>
        <button className="rounded-lg bg-slate-800 px-6 py-4 text-xl font-bold disabled:opacity-30" onClick={() => setI((x) => Math.min(slabs.length - 1, x + 1))} disabled={i >= slabs.length - 1}>Next ▶</button>
      </footer>
    </div>
  );
}

export default function CutStation() {
  const { id } = useParams();
  return id ? <SlabView orderId={Number(id)} /> : <ListPicker />;
}
