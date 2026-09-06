import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Scrap() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.getScrap(days).then(setData).catch((e) => setErr(e.message)); }, [days]);

  const rows: any[] = data?.rows ?? [];
  const totalScrap = rows.reduce((a, r) => a + r.scrapBF, 0);
  const totalUsed = rows.reduce((a, r) => a + r.usedBF, 0);
  const totalCost = rows.reduce((a, r) => a + r.scrapCost, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scrap by slab type</h1>
          <p className="text-sm text-muted-foreground">Logged automatically when a cut list is finished (every slab ticked off). Scrap = slab area not covered by pieces, in board feet at that slab's thickness. Glue-ups count as used foam.</p>
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">{err}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">{Math.round(totalScrap)} BF</div><div className="text-sm text-muted-foreground">scrap foam</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">{totalUsed + totalScrap ? Math.round((totalScrap / (totalUsed + totalScrap)) * 100) : 0}%</div><div className="text-sm text-muted-foreground">of foam cut ends up as scrap</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">${totalCost}</div><div className="text-sm text-muted-foreground">scrap at slab cost</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Per slab type</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Foam</th><th className="p-2 text-right">Lists</th><th className="p-2 text-right">Slabs</th><th className="p-2 text-right">Used BF</th><th className="p-2 text-right">Scrap BF</th><th className="p-2 text-right">Scrap %</th><th className="p-2 text-right">Glue-ups</th><th className="p-2 text-right">Scrap $</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.foamId} className="border-b">
                  <td className="p-2 font-semibold">{r.grade}</td>
                  <td className="p-2 text-right">{r.lists}</td>
                  <td className="p-2 text-right">{r.slabs}</td>
                  <td className="p-2 text-right">{r.usedBF}</td>
                  <td className="p-2 text-right font-bold">{r.scrapBF}</td>
                  <td className="p-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.scrapPct > 35 ? 'bg-red-100 text-red-800' : r.scrapPct > 20 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{r.scrapPct}%</span></td>
                  <td className="p-2 text-right">{r.gluedPieces}</td>
                  <td className="p-2 text-right">${r.scrapCost}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No finished cut lists in this window yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent lists</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">When</th><th className="p-2">List</th><th className="p-2">Foam</th><th className="p-2 text-right">Slabs</th><th className="p-2 text-right">Scrap BF</th><th className="p-2 text-right">Scrap %</th><th className="p-2">Usable remnants</th></tr></thead>
            <tbody>
              {(data?.recent ?? []).map((l: any) => (
                <tr key={l.id} className="border-b">
                  <td className="p-2 text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="p-2"><Link className="text-primary hover:underline" to={`/foam-orders/${l.foamOrderId}`}>{l.scheduleNumber ? `List ${l.scheduleNumber}` : `#${l.foamOrderId}`}</Link></td>
                  <td className="p-2">{l.grade}</td>
                  <td className="p-2 text-right">{l.slabs}</td>
                  <td className="p-2 text-right">{Math.round(l.scrapBF * 10) / 10}</td>
                  <td className="p-2 text-right">{l.scrapPct}%</td>
                  <td className="p-2 text-xs text-muted-foreground">{((l.remnants ?? []) as any[]).slice(0, 4).map((m) => `${m.w}×${m.h} (slab ${m.slab})`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
