/**
 * Shop-floor screen for the foam cutters. One slab at a time, drawn to scale
 * with big labels; the operator lays the cardboard templates on the slab in
 * this arrangement and cuts. Next/Prev walks through every slab of every foam
 * in the order. Works with a keyboard, a touch screen, or a TV + wireless mouse.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { NestSheet, colorFor } from '@/components/foam/NestSheet';

export default function CutStation() {
  const [params, setParams] = useSearchParams();
  const orderId = Number(params.get('order')) || null;
  const [orders, setOrders] = useState<any[]>([]);
  const [o, setO] = useState<any>(null);
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => { api.getFoamOrders().then((os) => setOrders(os.filter((x: any) => !['done'].includes(x.status)))).catch(() => null); }, []);
  useEffect(() => {
    if (!orderId) { setO(null); return; }
    api.getFoamOrder(orderId).then((x) => { setO(x); setI(0); try { setDone(new Set(JSON.parse(localStorage.getItem(`cut-done-${orderId}`) || '[]'))); } catch { setDone(new Set()); } });
  }, [orderId]);

  const slabs = useMemo(() => {
    if (!o) return [] as any[];
    const out: any[] = [];
    for (const r of o.requirements ?? []) {
      const plan = o.cutPlan?.[r.foamId];
      if (!plan) continue;
      for (const s of plan.sheets) out.push({ key: `${r.foamId}-${s.index}`, grade: r.grade, foamId: r.foamId, sheet: s, length: plan.sheetLength, width: plan.sheetWidth, total: plan.sheets.length });
    }
    return out;
  }, [o]);
  const keys = useMemo(() => (o ? [...new Set((o.lines as any[]).map((l) => l.code))] : []), [o]);
  const cur = slabs[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(slabs.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      if (e.key === 'Enter' && cur) markDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const markDone = () => {
    if (!cur) return;
    const n = new Set(done);
    n.has(cur.key) ? n.delete(cur.key) : n.add(cur.key);
    setDone(n);
    localStorage.setItem(`cut-done-${orderId}`, JSON.stringify([...n]));
    if (!done.has(cur.key)) setI((x) => Math.min(slabs.length - 1, x + 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-4">
          <Link to="/foam-orders" className="text-sm text-slate-400 hover:text-white">← Exit</Link>
          <select className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base" value={orderId ?? ''} onChange={(e) => setParams(e.target.value ? { order: e.target.value } : {})}>
            <option value="">— pick a cut list —</option>
            {orders.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.status})</option>)}
          </select>
        </div>
        {cur && (
          <div className="text-right">
            <div className="text-3xl font-black">{cur.grade}</div>
            <div className="text-sm text-slate-400">Slab {cur.sheet.index} of {cur.total} · {cur.length}" × {cur.width}" · {cur.sheet.pieces.length} pieces · {done.size}/{slabs.length} slabs done</div>
          </div>
        )}
      </header>

      <main className="flex flex-1 items-stretch gap-4 overflow-hidden p-4">
        {!o && <div className="m-auto text-2xl text-slate-400">Pick a cut list to start.</div>}
        {o && !cur && <div className="m-auto text-2xl text-slate-400">Nothing to cut in this list.</div>}
        {cur && (
          <>
            <div className={`flex flex-1 items-center justify-center rounded-xl ${done.has(cur.key) ? 'ring-4 ring-emerald-500' : ''}`}>
              <NestSheet sheet={cur.sheet} length={cur.length} width={cur.width} keys={keys} big />
            </div>
            <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-auto">
              <div className="text-xs uppercase tracking-wide text-slate-400">Pieces on this slab</div>
              {Object.entries(cur.sheet.pieces.reduce((acc: Record<string, { n: number; w: number; h: number }>, p: any) => { const k = p.label; acc[k] = acc[k] ? { ...acc[k], n: acc[k].n + 1 } : { n: 1, w: p.w, h: p.h }; return acc; }, {})).map(([label, v]: any) => (
                <div key={label} className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2">
                  <span className="h-4 w-4 rounded-sm" style={{ background: colorFor(label, keys) }} />
                  <span className="flex-1 text-sm"><b>{label.split(' ')[0]}</b> {label.split(' ').slice(1).join(' ')}</span>
                  <span className="text-xs text-slate-400">{v.n}× {v.w}×{v.h}</span>
                </div>
              ))}
            </aside>
          </>
        )}
      </main>

      {cur && (
        <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
          <button className="rounded-lg bg-slate-800 px-6 py-4 text-xl font-bold disabled:opacity-30" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>◀ Prev</button>
          <div className="flex flex-1 flex-wrap justify-center gap-1">
            {slabs.map((s, j) => (
              <button key={s.key} onClick={() => setI(j)} className={`h-3 w-6 rounded-sm ${j === i ? 'bg-orange-500' : done.has(s.key) ? 'bg-emerald-500' : 'bg-slate-700'}`} title={`${s.grade} slab ${s.sheet.index}`} />
            ))}
          </div>
          <button className={`rounded-lg px-6 py-4 text-xl font-bold ${done.has(cur.key) ? 'bg-emerald-700' : 'bg-emerald-600'}`} onClick={markDone}>{done.has(cur.key) ? '✓ Cut (undo)' : 'Mark slab cut ✓'}</button>
          <button className="rounded-lg bg-slate-800 px-6 py-4 text-xl font-bold disabled:opacity-30" onClick={() => setI((x) => Math.min(slabs.length - 1, x + 1))} disabled={i >= slabs.length - 1}>Next ▶</button>
        </footer>
      )}
    </div>
  );
}
