import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NestSheet } from '@/components/foam/NestSheet';
import { RefreshCw, ShoppingCart, Monitor, Printer } from 'lucide-react';

export default function FoamOrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const [o, setO] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.getFoamOrder(orderId).then(setO).catch((e) => setMsg(String(e)));
  useEffect(() => { load(); }, [orderId]);

  const keys = useMemo(() => (o ? [...new Set((o.lines as any[]).map((l) => l.code))] : []), [o]);
  if (!o) return <div className="p-6 text-muted-foreground">{msg || 'Loading…'}</div>;

  const reqs: any[] = o.requirements ?? [];
  const plan: Record<string, any> = o.cutPlan ?? {};
  const totalBf = reqs.reduce((a, r) => a + r.boardFeet, 0);
  const totalCost = reqs.reduce((a, r) => a + r.cost, 0);
  const shortfall = reqs.filter((r) => r.shortfall > 0);
  const missing = reqs[0]?.missingPatterns ?? [];

  const optimize = async () => { setBusy(true); try { setO(await api.optimizeFoamOrder(orderId)); setMsg('Re-nested.'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  const rfq = async (full: boolean) => {
    setBusy(true);
    try { const r = await api.createFoamRfq(orderId, full); setMsg(`Draft RFQ ${r.poName} created in Odoo (${r.lines} lines).`); await load(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const setStatus = async (status: string) => { setO(await api.updateFoamOrder(orderId, { status })); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/foam-orders" className="text-xs text-muted-foreground hover:underline">← Foam orders</Link>
          <h1 className="text-2xl font-bold">{o.name}</h1>
          <p className="text-sm text-muted-foreground">{(o.lines as any[]).length} lines · {Math.round(totalBf)} BF · ${totalCost.toFixed(0)} · status {o.status}{o.odooPoName ? ` · RFQ ${o.odooPoName}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={optimize} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Re-nest</Button>
          <Link to={`/cut-station?order=${o.id}`}><Button variant="outline"><Monitor className="mr-2 h-4 w-4" />Cut station</Button></Link>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Button onClick={() => rfq(false)} disabled={busy || !shortfall.length}><ShoppingCart className="mr-2 h-4 w-4" />RFQ shortfall in Odoo</Button>
          <Button variant="outline" onClick={() => rfq(true)} disabled={busy}>RFQ full qty</Button>
          <select className="rounded-md border bg-background px-2 text-sm" value={o.status} onChange={(e) => setStatus(e.target.value)}>
            {['draft', 'optimized', 'ordered', 'cut', 'done'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {msg && <div className="rounded-md border bg-muted p-3 text-sm print:hidden">{msg}</div>}
      {missing.length > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">No foam pattern yet for: {missing.join(', ')} — their foam is not in this list.</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Production orders</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm"><tbody>
              {(o.lines as any[]).map((l, i) => (
                <tr key={i} className="border-b"><td className="p-2 font-mono text-xs">{l.moName ?? ''}</td><td className="p-2"><Link className="text-primary hover:underline" to={`/skus/${l.skuId}`}>{l.code}</Link> {l.name?.replace(/^\S+\s/, '')}</td><td className="p-2 text-right">×{l.qty}</td></tr>
              ))}
            </tbody></table>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Foam requirement by slab</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Foam</th><th className="p-2 text-right">Pieces</th><th className="p-2 text-right">Net BF</th><th className="p-2 text-right">With waste</th><th className="p-2 text-right">On hand</th><th className="p-2 text-right">Shortfall</th><th className="p-2 text-right">Slabs</th><th className="p-2 text-right">Cost</th></tr></thead>
              <tbody>
                {reqs.map((r) => (
                  <tr key={r.foamId} className="border-b">
                    <td className="p-2 font-semibold">{r.grade}</td><td className="p-2 text-right">{r.pieceCount}</td><td className="p-2 text-right">{r.netBoardFeet}</td><td className="p-2 text-right font-bold">{r.boardFeet}</td>
                    <td className="p-2 text-right">{r.onHand}</td><td className={`p-2 text-right ${r.shortfall > 0 ? 'font-bold text-red-600' : ''}`}>{r.shortfall}</td>
                    <td className="p-2 text-right">{plan[r.foamId]?.sheets?.length ?? 0} × {r.sheetLengthIn}"×{r.sheetWidthIn}" ({Math.round((plan[r.foamId]?.utilization ?? 0) * 100)}%)</td>
                    <td className="p-2 text-right">${r.cost.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {reqs.map((r) => (
        <Card key={r.foamId}>
          <CardHeader><CardTitle className="text-base">{r.grade} — {plan[r.foamId]?.sheets?.length ?? 0} slab(s), {r.pieceCount} pieces{plan[r.foamId]?.unplaced?.length ? ` · ${plan[r.foamId].unplaced.length} piece(s) too big for the slab` : ''}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {(plan[r.foamId]?.sheets ?? []).map((s: any) => (
              <div key={s.index}>
                <div className="mb-1 text-sm font-semibold">Slab {s.index} of {plan[r.foamId].sheets.length}</div>
                <NestSheet sheet={s} length={plan[r.foamId].sheetLength} width={plan[r.foamId].sheetWidth} keys={keys} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
