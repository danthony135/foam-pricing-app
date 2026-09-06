/**
 * Scrap tracking by slab type. When a cut list is finished (every slab ticked
 * off, or the order set to cut/done), each foam's plan is logged: slabs used,
 * area used, scrap area, both in board feet, plus the usable remnants. The
 * summary groups those logs per foam over a window.
 */
import { prisma } from '../index';

export async function logScrapForOrder(orderId: number) {
  const o = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!o || !o.requirements || !o.cutPlan) return 0;
  const reqs = o.requirements as any[];
  const plan = o.cutPlan as Record<string, any>;
  const foams = await prisma.foam.findMany({ where: { id: { in: reqs.map((r) => r.foamId) } } });
  let n = 0;
  for (const r of reqs) {
    const p = plan[r.foamId];
    if (!p || !p.sheets?.length) continue;
    const foam = foams.find((f) => f.id === r.foamId);
    const thk = foam?.thicknessIn ?? r.thicknessIn ?? 1;
    const slabSqIn = p.sheetLength * p.sheetWidth;
    const usedSqIn = p.sheets.reduce((a: number, s: any) => a + (s.usedArea || 0), 0);
    const scrapSqIn = p.sheets.length * slabSqIn - usedSqIn;
    const remnants = p.sheets.flatMap((s: any) => (s.remnants ?? []).map((m: any) => ({ slab: s.index, w: m.w, h: m.h })));
    await prisma.scrapLog.upsert({
      where: { foamOrderId_foamId: { foamOrderId: o.id, foamId: r.foamId } },
      update: { slabs: p.sheets.length, slabSqIn, usedSqIn, scrapSqIn, scrapBF: (scrapSqIn * thk) / 144, usedBF: (usedSqIn * thk) / 144, gluedPieces: p.gluedPieces ?? 0, remnants },
      create: { foamOrderId: o.id, foamId: r.foamId, grade: r.grade, scheduleNumber: o.scheduleNumber ?? null, slabs: p.sheets.length, slabSqIn, usedSqIn, scrapSqIn, scrapBF: (scrapSqIn * thk) / 144, usedBF: (usedSqIn * thk) / 144, gluedPieces: p.gluedPieces ?? 0, remnants },
    });
    n++;
  }
  return n;
}

export async function scrapSummary(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const logs = await prisma.scrapLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } });
  const foams = await prisma.foam.findMany({ include: { inventory: true } });
  const byFoam = new Map<number, any>();
  for (const l of logs) {
    const f = foams.find((x) => x.id === l.foamId);
    const c = byFoam.get(l.foamId) ?? { foamId: l.foamId, grade: f?.grade ?? l.grade, thicknessIn: f?.thicknessIn ?? null, costPerBoardFoot: f?.costPerBoardFoot ?? 0, lists: 0, slabs: 0, usedBF: 0, scrapBF: 0, gluedPieces: 0 };
    c.lists++;
    c.slabs += l.slabs;
    c.usedBF += l.usedBF;
    c.scrapBF += l.scrapBF;
    c.gluedPieces += l.gluedPieces;
    byFoam.set(l.foamId, c);
  }
  const rows = [...byFoam.values()].map((c) => ({
    ...c,
    usedBF: Math.round(c.usedBF * 10) / 10,
    scrapBF: Math.round(c.scrapBF * 10) / 10,
    scrapPct: c.usedBF + c.scrapBF ? Math.round((c.scrapBF / (c.usedBF + c.scrapBF)) * 100) : 0,
    scrapCost: Math.round(c.scrapBF * c.costPerBoardFoot),
    bfPerSlab: c.slabs ? Math.round(((c.usedBF + c.scrapBF) / c.slabs) * 10) / 10 : 0,
  })).sort((a, b) => b.scrapBF - a.scrapBF);
  return { days, rows, recent: logs.slice(0, 50).map((l) => ({ ...l, scrapPct: l.usedSqIn + l.scrapSqIn ? Math.round((l.scrapSqIn / (l.usedSqIn + l.scrapSqIn)) * 100) : 0 })) };
}
