import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, UploadCloud, Copy } from 'lucide-react';

const bf = (l: number, w: number, h: number) => (l * w * h) / 144;

export default function SkuDetail() {
  const { id } = useParams();
  const skuId = Number(id);
  const [sku, setSku] = useState<any>(null);
  const [foams, setFoams] = useState<any[]>([]);
  const [dacrons, setDacrons] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ name: 'Seat core', foamId: '', lengthIn: '', widthIn: '', heightIn: '', qty: 1, wrapDacron: false });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');

  const load = async () => {
    const [s, f, d, all] = await Promise.all([api.getSku(skuId), api.getFoams(), api.getDacrons(), api.getSkus(true)]);
    setSku(s);
    setFoams(f.filter((x: any) => x.active !== false));
    setDacrons(d);
    setSkus(all.filter((x: any) => x.id !== skuId && x.pieceCount > 0));
  };
  useEffect(() => { load().catch((e) => setMsg(String(e))); }, [skuId]);

  if (!sku) return <div className="p-6 text-muted-foreground">{msg || 'Loading…'}</div>;

  const onFoamChange = (foamId: string, setter: (v: any) => void, cur: any) => {
    const f = foams.find((x) => x.id === Number(foamId));
    setter({ ...cur, foamId, heightIn: f?.thicknessIn && !cur.heightIn ? f.thicknessIn : cur.heightIn });
  };

  const add = async () => {
    setBusy(true);
    try {
      await api.addPiece(skuId, { ...draft, sortOrder: sku.pieces.length });
      setDraft({ ...draft, name: '', lengthIn: '', widthIn: '' });
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const save = async (p: any) => {
    setBusy(true);
    try { await api.updatePiece(skuId, p.id, p); await load(); setMsg('Saved'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const remove = async (p: any) => { await api.deletePiece(skuId, p.id); await load(); };
  const push = async () => {
    setBusy(true);
    setMsg('Pushing foam lines to the Odoo BOM…');
    try {
      const r = await api.pushSkuBom(skuId);
      setMsg(`Odoo BOM ${r.bomId}: ` + r.result.map((x: any) => `${x.product} ${x.qty} BF (${x.action})`).join(' · '));
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!copyFrom) return;
    await api.copyPieces(skuId, Number(copyFrom), true);
    await load();
  };

  const edit = (p: any, patch: any) => setSku({ ...sku, pieces: sku.pieces.map((x: any) => (x.id === p.id ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/skus" className="text-xs text-muted-foreground hover:underline">← SKUs</Link>
          <h1 className="text-2xl font-bold">{sku.code} <span className="font-normal text-muted-foreground">{sku.shortName}</span></h1>
          <p className="text-sm text-muted-foreground">{sku.collection} · Odoo template {sku.odooTemplateId} · BOM {sku.odooBomId ?? 'none yet'}{sku.pushedAt ? ` · pushed ${new Date(sku.pushedAt).toLocaleString()}` : ''}</p>
        </div>
        <Button onClick={push} disabled={busy || !sku.pieces.length}><UploadCloud className="mr-2 h-4 w-4" />Push foam BOM to Odoo</Button>
      </div>
      {msg && <div className="rounded-md border bg-muted p-3 text-sm">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Foam pieces (the pattern)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Piece</th><th className="p-2">Foam</th><th className="p-2">L"</th><th className="p-2">W"</th><th className="p-2">Thk"</th><th className="p-2">Qty</th><th className="p-2">Dacron</th><th className="p-2 text-right">BF</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {sku.pieces.map((p: any) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2"><Input value={p.name} onChange={(e) => edit(p, { name: e.target.value })} /></td>
                    <td className="p-2">
                      <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={p.foamId ?? ''} onChange={(e) => onFoamChange(e.target.value, (v) => edit(p, v), p)}>
                        <option value="">— pick —</option>
                        {foams.map((f) => <option key={f.id} value={f.id}>{f.grade}</option>)}
                      </select>
                    </td>
                    <td className="p-2 w-20"><Input type="number" step="0.25" value={p.lengthIn} onChange={(e) => edit(p, { lengthIn: e.target.value })} /></td>
                    <td className="p-2 w-20"><Input type="number" step="0.25" value={p.widthIn} onChange={(e) => edit(p, { widthIn: e.target.value })} /></td>
                    <td className="p-2 w-20"><Input type="number" step="0.25" value={p.heightIn} onChange={(e) => edit(p, { heightIn: e.target.value })} /></td>
                    <td className="p-2 w-16"><Input type="number" min={1} value={p.qty} onChange={(e) => edit(p, { qty: e.target.value })} /></td>
                    <td className="p-2 text-center"><input type="checkbox" checked={!!p.wrapDacron} onChange={(e) => edit(p, { wrapDacron: e.target.checked })} /></td>
                    <td className="p-2 text-right">{(bf(+p.lengthIn, +p.widthIn, +p.heightIn) * +p.qty).toFixed(2)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => save(p)} title="Save"><Save className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)} title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/20">
                  <td className="p-2"><Input placeholder="Seat core" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                  <td className="p-2">
                    <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={draft.foamId} onChange={(e) => onFoamChange(e.target.value, setDraft, draft)}>
                      <option value="">— pick —</option>
                      {foams.map((f) => <option key={f.id} value={f.id}>{f.grade}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><Input type="number" step="0.25" placeholder="L" value={draft.lengthIn} onChange={(e) => setDraft({ ...draft, lengthIn: e.target.value })} /></td>
                  <td className="p-2"><Input type="number" step="0.25" placeholder="W" value={draft.widthIn} onChange={(e) => setDraft({ ...draft, widthIn: e.target.value })} /></td>
                  <td className="p-2"><Input type="number" step="0.25" placeholder="T" value={draft.heightIn} onChange={(e) => setDraft({ ...draft, heightIn: e.target.value })} /></td>
                  <td className="p-2"><Input type="number" min={1} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={draft.wrapDacron} onChange={(e) => setDraft({ ...draft, wrapDacron: e.target.checked })} /></td>
                  <td className="p-2 text-right text-muted-foreground">{draft.lengthIn && draft.widthIn && draft.heightIn ? (bf(+draft.lengthIn, +draft.widthIn, +draft.heightIn) * +draft.qty).toFixed(2) : ''}</td>
                  <td className="p-2"><Button size="sm" onClick={add} disabled={busy || !draft.lengthIn || !draft.widthIn || !draft.heightIn}><Plus className="h-4 w-4" /></Button></td>
                </tr>
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-2 border-t p-3 text-sm">
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Copy pattern from</span>
              <select className="rounded-md border bg-background px-2 py-1 text-sm" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">— SKU —</option>
                {skus.map((s) => <option key={s.id} value={s.id}>{s.code} {s.shortName} ({s.pieceCount})</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={copy} disabled={!copyFrom}>Copy (replaces)</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Foam BOM (what gets pushed)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!sku.foam.totals.length && <p className="text-muted-foreground">Add pieces with a foam type.</p>}
              {sku.foam.totals.map((t: any) => {
                const odoo = (sku.odooFoamLines ?? []).find((l: any) => l.foamId === t.foamId);
                return (
                  <div key={t.foamId} className="flex items-center justify-between rounded-md border p-2">
                    <div><div className="font-semibold">{t.grade}</div><div className="text-xs text-muted-foreground">{t.pieces} pieces · net {t.netBoardFeet} BF</div></div>
                    <div className="text-right"><div className="font-bold">{t.boardFeet} BF</div><div className="text-xs text-muted-foreground">Odoo: {odoo ? `${odoo.qty} ${odoo.uom}` : '—'}</div></div>
                  </div>
                );
              })}
              {(sku.odooFoamLines ?? []).filter((l: any) => !sku.foam.totals.some((t: any) => t.foamId === l.foamId)).map((l: any) => (
                <div key={l.lineId} className="flex items-center justify-between rounded-md border border-dashed p-2 text-muted-foreground"><span>{l.name}</span><span>{l.qty} {l.uom} in Odoo, not in pattern</span></div>
              ))}
              <p className="text-xs text-muted-foreground">Waste allowance {sku.foam.wastePct}% {sku.wastePct != null ? '(SKU override)' : '(global)'} · Dacron {sku.foam.dacronSqFt} sq ft (not pushed)</p>
              <div className="flex gap-2">
                <Input type="number" placeholder="Waste % override" defaultValue={sku.wastePct ?? ''} onBlur={(e) => api.updateSku(skuId, { wastePct: e.target.value }).then(load)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea className="h-24 w-full rounded-md border p-2 text-sm" defaultValue={sku.notes ?? ''} onBlur={(e) => api.updateSku(skuId, { notes: e.target.value })} placeholder="Template box location, gotchas…" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
