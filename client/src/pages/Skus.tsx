import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Upload } from 'lucide-react';

const STATUS: Record<string, { label: string; cls: string }> = {
  ready: { label: 'Pattern ready', cls: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Needs foam type', cls: 'bg-amber-100 text-amber-800' },
  missing: { label: 'No pattern', cls: 'bg-red-100 text-red-800' },
};

export default function Skus() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [q, setQ] = useState('');
  const [collection, setCollection] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const load = async () => {
    const [r, s] = await Promise.all([api.getSkus(), api.getOdooStatus()]);
    setRows(r);
    setStatus(s);
  };
  useEffect(() => { load().catch((e) => setMsg(String(e))); }, []);

  const collections = useMemo(() => [...new Set(rows.map((r) => r.collection))].sort(), [rows]);
  const shown = rows.filter((r) => (!q || `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase())) && (!collection || r.collection === collection) && (!filter || r.status === filter));
  const counts = { ready: rows.filter((r) => r.status === 'ready').length, partial: rows.filter((r) => r.status === 'partial').length, missing: rows.filter((r) => r.status === 'missing').length };

  const sync = async () => {
    setBusy(true);
    setMsg('Syncing from Odoo…');
    try {
      const r = await api.syncOdoo();
      setMsg(`Synced ${r.materials.total} foam products and ${r.skus.total} SKUs (${r.skus.created} new).`);
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const doImport = async () => {
    // CSV: code,piece,foam,length,width,height,qty,dacron
    const lines = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const header = lines[0].toLowerCase().split(/,|\t/).map((h) => h.trim());
    const rowsIn = lines.slice(1).map((l) => { const cells = l.split(/,|\t/); const o: any = {}; header.forEach((h, i) => (o[h] = cells[i]?.trim())); return o; });
    setBusy(true);
    try {
      const r = await api.importPieces(rowsIn);
      setMsg(`Imported ${r.pieces} pieces for ${r.skus} SKUs.${r.errors.length ? ' Errors: ' + r.errors.slice(0, 5).join(' · ') : ''}`);
      setImportOpen(false);
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">SKUs & foam patterns</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} manufactured SKUs from Odoo · {counts.ready} ready · {counts.partial} need a foam type · {counts.missing} without a pattern
            {status?.skusSyncedAt ? ` · last sync ${new Date(status.skusSyncedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen((v) => !v)}><Upload className="mr-2 h-4 w-4" />Import pieces (CSV)</Button>
          <Button onClick={sync} disabled={busy || !status?.configured}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Sync from Odoo</Button>
        </div>
      </div>
      {!status?.configured && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Odoo is not configured on this server (ODOO_URL / ODOO_DB / ODOO_API_KEY).</div>}
      {msg && <div className="rounded-md border bg-muted p-3 text-sm">{msg}</div>}

      {importOpen && (
        <Card><CardContent className="space-y-2 p-4">
          <p className="text-sm">Paste CSV with a header row: <code>code,piece,foam,length,width,height,qty,dacron</code>. Foam = the Odoo grade text (e.g. <code>5" Foam</code>) or just the thickness (<code>5</code>). Existing pieces of each SKU in the file are replaced.</p>
          <textarea className="h-40 w-full rounded-md border p-2 font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'code,piece,foam,length,width,height,qty,dacron\n400-30,Seat core,5,24,26,5,3,yes\n400-30,Back core,2,24,20,2,3,no'} />
          <Button onClick={doImport} disabled={busy}>Import</Button>
        </CardContent></Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search code or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={collection} onChange={(e) => setCollection(e.target.value)}>
          <option value="">All collections</option>
          {collections.map((c) => <option key={c} value={c}>{c || '(none)'}</option>)}
        </select>
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ready">Pattern ready</option>
          <option value="partial">Needs foam type</option>
          <option value="missing">No pattern</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Code</th><th className="p-3">Name</th><th className="p-3">Collection</th><th className="p-3">Pieces</th><th className="p-3 text-right">Net BF</th><th className="p-3 text-right">BF in Odoo</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-semibold"><Link className="text-primary hover:underline" to={`/skus/${r.id}`}>{r.code}</Link></td>
                  <td className="p-3">{r.shortName}</td>
                  <td className="p-3 text-muted-foreground">{r.collection}</td>
                  <td className="p-3">{r.pieceCount}</td>
                  <td className="p-3 text-right">{r.netBoardFeet || ''}</td>
                  <td className="p-3 text-right">{r.odooBoardFeet || ''}{r.pieceCount && r.pushedAt ? '' : r.odooBoardFeet ? ' (legacy)' : ''}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{rows.length ? 'No matches.' : 'No SKUs yet — click Sync from Odoo.'}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
