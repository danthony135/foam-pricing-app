import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tags, Scissors, Monitor, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [skus, setSkus] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [low, setLow] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api.getSkus(), api.getFoamOrders(), api.getOdooStatus(), api.getFoamLowStock().catch(() => [])])
      .then(([s, o, st, l]) => { setSkus(s); setOrders(o); setStatus(st); setLow(l); })
      .catch((e) => setErr(String(e)));
  }, []);

  const ready = skus.filter((s) => s.status === 'ready').length;
  const partial = skus.filter((s) => s.status === 'partial').length;
  const missing = skus.filter((s) => s.status === 'missing').length;
  const open = orders.filter((o) => !['done'].includes(o.status));
  const byCollection = Object.entries(skus.reduce((acc: Record<string, { n: number; ready: number }>, s) => { const c = (acc[s.collection || '(none)'] ??= { n: 0, ready: 0 }); c.n++; if (s.status === 'ready') c.ready++; return acc; }, {})).sort((a, b) => b[1].n - a[1].n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Foam App</h1>
        <p className="text-sm text-muted-foreground">Foam patterns by SKU → board-feet BOMs in Odoo → cut lists nested onto slabs → the cut station screen.</p>
      </div>
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/skus"><Card className="h-full hover:bg-muted/40"><CardContent className="p-5"><div className="text-3xl font-bold">{skus.length}</div><div className="text-sm text-muted-foreground">SKUs from Odoo</div></CardContent></Card></Link>
        <Link to="/skus?status=ready"><Card className="h-full hover:bg-muted/40"><CardContent className="p-5"><div className="text-3xl font-bold text-emerald-600">{ready}</div><div className="text-sm text-muted-foreground">Patterns ready</div></CardContent></Card></Link>
        <Link to="/skus"><Card className="h-full hover:bg-muted/40"><CardContent className="p-5"><div className="text-3xl font-bold text-amber-600">{partial + missing}</div><div className="text-sm text-muted-foreground">Still need a pattern ({partial} need a foam type)</div></CardContent></Card></Link>
        <Link to="/foam-orders"><Card className="h-full hover:bg-muted/40"><CardContent className="p-5"><div className="text-3xl font-bold">{open.length}</div><div className="text-sm text-muted-foreground">Open cut lists</div></CardContent></Card></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Pattern coverage by collection</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {byCollection.map(([c, v]) => (
                  <tr key={c} className="border-b">
                    <td className="p-2">{c}</td>
                    <td className="p-2 w-1/2"><div className="h-2 w-full rounded bg-muted"><div className="h-2 rounded bg-emerald-500" style={{ width: `${v.n ? (v.ready / v.n) * 100 : 0}%` }} /></div></td>
                    <td className="p-2 text-right text-muted-foreground">{v.ready}/{v.n}</td>
                  </tr>
                ))}
                {!skus.length && <tr><td className="p-4 text-muted-foreground">No SKUs yet — run a sync in Settings.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Shortcuts</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Link to="/skus" className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40"><Tags className="h-4 w-4" /> Enter or import patterns</Link>
              <Link to="/foam-orders" className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40"><Scissors className="h-4 w-4" /> Build a cut list from open MOs</Link>
              <Link to="/cut-station" className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40"><Monitor className="h-4 w-4" /> Open the cut station screen</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Low foam stock</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {!low.length && <div className="text-muted-foreground">Nothing under threshold.</div>}
              {low.map((l: any) => <div key={l.id} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> {l.foam?.grade}: {l.boardFeetOnHand} BF</div>)}
            </CardContent>
          </Card>
          <Card><CardContent className="p-4 text-xs text-muted-foreground">Odoo: {status?.configured ? 'connected' : 'not configured'}{status?.skusSyncedAt ? ` · last sync ${new Date(status.skusSyncedAt).toLocaleString()}` : ''}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
