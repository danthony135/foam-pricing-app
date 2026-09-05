import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function OdooSettings() {
  const [s, setS] = useState<any>(null);
  const [vendor, setVendor] = useState('');
  const [waste, setWaste] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.getOdooStatus().then((x) => { setS(x); setVendor(String(x.foamVendorId)); setWaste(String(x.wastePct)); });
  useEffect(() => { load().catch((e) => setMsg(String(e))); }, []);

  const save = async () => { await api.updateOdooSettings({ foamVendorId: Number(vendor), wastePct: Number(waste) }); setMsg('Saved'); load(); };
  const sync = async () => { setBusy(true); setMsg('Syncing…'); try { const r = await api.syncOdoo(); setMsg(`Synced ${r.materials.total} foam products, ${r.skus.total} SKUs.`); load(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Odoo</CardTitle>
        <CardDescription>Manufactured SKUs, raw foam (board feet), open production orders, BOM push, and RFQs all go through the Odoo JSON-2 API (ODOO_URL / ODOO_DB / ODOO_API_KEY on the server). Sync runs hourly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {s ? (
          <div className="space-y-1">
            <div>Connection: <b className={s.configured ? 'text-emerald-600' : 'text-red-600'}>{s.configured ? s.url : 'not configured'}</b></div>
            <div>{s.skuCount} active SKUs synced · {s.withPattern} with a foam pattern · {s.foamCount} foam products linked</div>
            <div className="text-muted-foreground">Last SKU sync {s.skusSyncedAt ? new Date(s.skusSyncedAt).toLocaleString() : 'never'} · materials {s.materialsSyncedAt ? new Date(s.materialsSyncedAt).toLocaleString() : 'never'}</div>
          </div>
        ) : <div className="text-muted-foreground">Loading…</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Foam vendor (Odoo partner id, Foam Brothers = 43)</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
          <div><Label>Waste allowance % (BOM BF = net × (1 + waste))</Label><Input value={waste} onChange={(e) => setWaste(e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save}>Save</Button>
          <Button variant="outline" onClick={sync} disabled={busy || !s?.configured}>Sync now</Button>
        </div>
        {msg && <div className="text-muted-foreground">{msg}</div>}
      </CardContent>
    </Card>
  );
}
