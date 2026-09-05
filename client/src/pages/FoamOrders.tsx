import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';

export default function FoamOrders() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [mos, setMos] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [name, setName] = useState('');
  const [loadingMos, setLoadingMos] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [skus, setSkus] = useState<any[]>([]);
  const [manualLines, setManualLines] = useState<{ skuId: string; qty: string }[]>([{ skuId: '', qty: '1' }]);

  const load = () => api.getFoamOrders().then(setOrders).catch((e) => setMsg(String(e)));
  useEffect(() => { load(); api.getSkus().then(setSkus).catch(() => null); }, []);

  const loadMos = async () => {
    setLoadingMos(true);
    try { setMos(await api.getOpenMos('confirmed,progress')); } catch (e: any) { setMsg(e.message); } finally { setLoadingMos(false); }
  };

  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pickAll = (ids: number[]) => setPicked(new Set(ids));

  const create = async () => {
    setBusy(true);
    try {
      const body = manual
        ? { name, lines: manualLines.filter((l) => l.skuId).map((l) => ({ skuId: Number(l.skuId), qty: Number(l.qty) || 1 })) }
        : { name, moIds: [...picked] };
      const o = await api.createFoamOrder(body);
      nav(`/foam-orders/${o.id}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const withPattern = mos.filter((m) => m.hasPattern);
  const without = mos.filter((m) => !m.hasPattern);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Foam orders & cut lists</h1>
          <p className="text-sm text-muted-foreground">Pick open production orders from Odoo (or type SKUs), and the app builds the foam requirement per slab thickness, nests the pieces, and drafts the RFQ for any shortfall.</p>
        </div>
        <Link to="/cut-station"><Button variant="outline">Open cut station</Button></Link>
      </div>
      {msg && <div className="rounded-md border bg-muted p-3 text-sm">{msg}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">New cut list</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={manual ? 'outline' : 'default'} onClick={() => { setManual(false); if (!mos.length) loadMos(); }}>From open MOs</Button>
            <Button size="sm" variant={manual ? 'default' : 'outline'} onClick={() => setManual(true)}>Type SKUs</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name (e.g. Week 37 seat cores)" value={name} onChange={(e) => setName(e.target.value)} />
          {manual ? (
            <div className="space-y-2">
              {manualLines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select className="flex-1 rounded-md border bg-background px-2 py-2 text-sm" value={l.skuId} onChange={(e) => setManualLines(manualLines.map((x, j) => (j === i ? { ...x, skuId: e.target.value } : x)))}>
                    <option value="">— SKU —</option>
                    {skus.map((s) => <option key={s.id} value={s.id}>{s.code} {s.shortName}{s.pieceCount ? '' : ' (no pattern)'}</option>)}
                  </select>
                  <Input className="w-24" type="number" min={1} value={l.qty} onChange={(e) => setManualLines(manualLines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setManualLines([...manualLines, { skuId: '', qty: '1' }])}><Plus className="mr-1 h-4 w-4" />Line</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Button size="sm" variant="outline" onClick={loadMos} disabled={loadingMos}><RefreshCw className={`mr-1 h-4 w-4 ${loadingMos ? 'animate-spin' : ''}`} />Load open MOs</Button>
                <span className="text-muted-foreground">{mos.length} open · {withPattern.length} with a foam pattern · {without.length} without</span>
                {withPattern.length > 0 && <Button size="sm" variant="ghost" onClick={() => pickAll(withPattern.map((m) => m.moId))}>Select all with pattern</Button>}
              </div>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    {mos.map((m) => (
                      <tr key={m.moId} className={`border-b ${m.hasPattern ? '' : 'text-muted-foreground'}`}>
                        <td className="p-2"><input type="checkbox" disabled={!m.hasPattern} checked={picked.has(m.moId)} onChange={() => toggle(m.moId)} /></td>
                        <td className="p-2 font-mono text-xs">{m.moName}</td>
                        <td className="p-2">{m.product}</td>
                        <td className="p-2">×{m.qty}</td>
                        <td className="p-2 text-xs">{m.dateStart?.slice(0, 10)} · {m.origin}</td>
                        <td className="p-2 text-xs">{m.hasPattern ? '' : m.skuId ? <Link className="text-primary hover:underline" to={`/skus/${m.skuId}`}>add pattern</Link> : 'not a synced SKU'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Button onClick={create} disabled={busy || (manual ? !manualLines.some((l) => l.skuId) : !picked.size)}>Build cut list & nest</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Source</th><th className="p-3">Lines</th><th className="p-3 text-right">Board feet</th><th className="p-3">Status</th><th className="p-3">Odoo RFQ</th><th className="p-3">Created</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-semibold"><Link className="text-primary hover:underline" to={`/foam-orders/${o.id}`}>{o.name}</Link></td>
                  <td className="p-3">{o.source === 'mo' ? 'Odoo MOs' : 'manual'}</td>
                  <td className="p-3">{o.lineCount}</td>
                  <td className="p-3 text-right">{Math.round(o.boardFeet)}</td>
                  <td className="p-3">{o.status}</td>
                  <td className="p-3">{o.odooPoName ?? ''}</td>
                  <td className="p-3 text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No cut lists yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
