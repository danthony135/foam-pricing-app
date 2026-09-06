import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { Foam } from '@/types';

type Row = Foam & { _dirty?: boolean };

export default function FoamLibrary() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState({ grade: '', thicknessIn: '', sheetLengthIn: '82', sheetWidthIn: '36', costPerBoardFoot: '', supplier: '' });

  const load = () => api.getFoams().then(setRows).catch((e) => setMsg(String(e)));
  useEffect(() => { load(); }, []);

  const edit = (id: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));
  const save = async (r: Row) => {
    const { _dirty, id, createdAt, updatedAt, ...data } = r as any;
    await api.updateFoam(id, { ...data, thicknessIn: data.thicknessIn === '' || data.thicknessIn == null ? null : Number(data.thicknessIn), sheetLengthIn: Number(data.sheetLengthIn) || 82, sheetWidthIn: Number(data.sheetWidthIn) || 36, costPerBoardFoot: Number(data.costPerBoardFoot) || 0, density: Number(data.density) || 0 });
    setMsg(`Saved ${r.grade}`);
    load();
  };
  const remove = async (r: Row) => { if (!confirm(`Delete ${r.grade}? Pieces using it lose their foam type.`)) return; await api.deleteFoam(r.id); load(); };
  const add = async () => {
    if (!draft.grade) return;
    await api.createFoam({ grade: draft.grade, density: 0, thicknessIn: draft.thicknessIn ? Number(draft.thicknessIn) : null, sheetLengthIn: Number(draft.sheetLengthIn) || 82, sheetWidthIn: Number(draft.sheetWidthIn) || 36, costPerBoardFoot: Number(draft.costPerBoardFoot) || 0, supplier: draft.supplier || null });
    setDraft({ ...draft, grade: '', thicknessIn: '', costPerBoardFoot: '' });
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Foam slabs</h1>
        <p className="text-sm text-muted-foreground">The slab foams pieces are cut from. Rows linked to Odoo are created by the sync (board-feet products in "Components / Foam & Fill"); cost per BF comes from Odoo. Set each slab's real length and width here — the nester packs onto these.</p>
      </div>
      {msg && <div className="rounded-md border bg-muted p-3 text-sm">{msg}</div>}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-2">Grade</th><th className="p-2">Thickness"</th><th className="p-2">Slab L"</th><th className="p-2">Slab W"</th><th className="p-2">$/BF</th><th className="p-2">Supplier</th><th className="p-2">Odoo</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b ${r.active === false ? 'opacity-50' : ''}`}>
                  <td className="p-2"><Input value={r.grade} onChange={(e) => edit(r.id, { grade: e.target.value })} /></td>
                  <td className="p-2 w-24"><Input type="number" step="0.25" value={r.thicknessIn ?? ''} onChange={(e) => edit(r.id, { thicknessIn: e.target.value as any })} /></td>
                  <td className="p-2 w-24"><Input type="number" value={r.sheetLengthIn ?? 82} onChange={(e) => edit(r.id, { sheetLengthIn: e.target.value as any })} /></td>
                  <td className="p-2 w-24"><Input type="number" value={r.sheetWidthIn ?? 36} onChange={(e) => edit(r.id, { sheetWidthIn: e.target.value as any })} /></td>
                  <td className="p-2 w-24"><Input type="number" step="0.01" value={r.costPerBoardFoot} onChange={(e) => edit(r.id, { costPerBoardFoot: e.target.value as any })} /></td>
                  <td className="p-2"><Input value={r.supplier ?? ''} onChange={(e) => edit(r.id, { supplier: e.target.value })} /></td>
                  <td className="p-2 text-xs text-muted-foreground">{r.odooTemplateId ? `tmpl ${r.odooTemplateId}` : 'local only'}</td>
                  <td className="p-2 whitespace-nowrap">
                    <Button size="sm" variant={r._dirty ? 'default' : 'ghost'} onClick={() => save(r)} title="Save"><Save className="h-4 w-4" /></Button>
                    {!r.odooTemplateId && <Button size="sm" variant="ghost" onClick={() => remove(r)} title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20">
                <td className="p-2"><Input placeholder="New grade (local)" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} /></td>
                <td className="p-2"><Input type="number" step="0.25" placeholder="T" value={draft.thicknessIn} onChange={(e) => setDraft({ ...draft, thicknessIn: e.target.value })} /></td>
                <td className="p-2"><Input type="number" value={draft.sheetLengthIn} onChange={(e) => setDraft({ ...draft, sheetLengthIn: e.target.value })} /></td>
                <td className="p-2"><Input type="number" value={draft.sheetWidthIn} onChange={(e) => setDraft({ ...draft, sheetWidthIn: e.target.value })} /></td>
                <td className="p-2"><Input type="number" step="0.01" placeholder="$" value={draft.costPerBoardFoot} onChange={(e) => setDraft({ ...draft, costPerBoardFoot: e.target.value })} /></td>
                <td className="p-2"><Input placeholder="Supplier" value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></td>
                <td className="p-2"></td>
                <td className="p-2"><Button size="sm" onClick={add} disabled={!draft.grade}><Plus className="h-4 w-4" /></Button></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
