/**
 * Odoo ↔ foam app sync.
 *
 * Odoo shape (Couch Potatoes, verified 2026-09-05):
 *  - Manufactured SKUs are product.templates named "<code> <name>", code like
 *    400-30 / 787-35L / L400-30 (leather). "[ACPPARTS] …" templates are kit
 *    pieces, not SKUs. 980 templates match (606 active).
 *  - Each SKU has one active normal mrp.bom; today its lines are fabric colour
 *    variants only. Foam is NOT on any live BOM (194 legacy foam lines sit on
 *    inactive BOMs). This app becomes the source of truth for foam and pushes
 *    board-feet lines onto the SKU's active BOM.
 *  - Raw foam = product.templates in category "Components / Foam & Fill" with
 *    UoM "BF" (e.g. [A00018] 5" Foam, 7423). Vendor: Foam Brothers (partner 43).
 */
import { prisma } from '../index';
import { odoo, odooConfigured } from './odoo';
import { calculateBoardFeet } from '../utils/boardFeet';

export const SKU_NAME_RE = /^(L?\d{3}-\d{2,3}[A-Za-z]?)\s+(.*)$/;
export const DEFAULT_WASTE_PCT = 10;
export const DEFAULT_VENDOR_ID = 43; // Foam Brothers

export function parseSkuName(name: string): { code: string; shortName: string } | null {
  const m = SKU_NAME_RE.exec(name || '');
  if (!m) return null;
  return { code: m[1].toUpperCase(), shortName: m[2].trim() };
}

export function collectionFromCategory(categ: unknown): string {
  if (!Array.isArray(categ)) return '';
  const name = String(categ[1] ?? '');
  return (name.split('/').pop() || name).trim();
}

function parseThickness(name: string): number | null {
  const m = /(\d+(?:\.\d+)?|\.\d+)\s*"/.exec(name);
  if (m) return parseFloat(m[1]);
  const frac = /(\d+)\/(\d+)/.exec(name);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  return null;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? ((row.value as unknown) as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await prisma.appSetting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } });
}

// ---------------------------------------------------------------------------
// Raw materials: foam (BF) + dacron
// ---------------------------------------------------------------------------
export async function syncFoamMaterials() {
  const templates = await odoo.searchRead(
    'product.template',
    [['categ_id.name', 'ilike', 'Foam'], ['uom_id.name', '=', 'BF']],
    ['id', 'name', 'default_code', 'standard_price', 'qty_available', 'virtual_available', 'seller_ids', 'active', 'product_variant_ids'],
    { context: { active_test: false } }
  );
  const sellerIds = templates.flatMap((t: any) => t.seller_ids as number[]);
  const sellers = sellerIds.length ? await odoo.read('product.supplierinfo', sellerIds, ['product_tmpl_id', 'partner_id', 'price']) : [];
  const sellerByTmpl = new Map<number, any>();
  for (const s of sellers) if (!sellerByTmpl.has(s.product_tmpl_id[0])) sellerByTmpl.set(s.product_tmpl_id[0], s);

  let created = 0, updated = 0;
  for (const t of templates) {
    const grade = t.name.replace(/^\[[^\]]+\]\s*/, '').trim();
    const seller = sellerByTmpl.get(t.id);
    const supplier = seller ? seller.partner_id[1] : undefined;
    const cost = seller?.price || t.standard_price || 0;
    const data = {
      grade,
      thicknessIn: parseThickness(grade),
      costPerBoardFoot: cost,
      odooProductId: t.product_variant_ids?.[0] ?? null,
      supplier,
      active: !!t.active,
      description: `Odoo ${t.name}`,
    };
    const existing = await prisma.foam.findFirst({ where: { OR: [{ odooTemplateId: t.id }, { grade }] } });
    if (existing) {
      await prisma.foam.update({ where: { id: existing.id }, data: { ...data, odooTemplateId: t.id } });
      updated++;
    } else {
      await prisma.foam.create({ data: { ...data, odooTemplateId: t.id, density: 0 } });
      created++;
    }
    const foam = await prisma.foam.findUnique({ where: { odooTemplateId: t.id } });
    if (foam) {
      await prisma.foamInventory.upsert({
        where: { foamId: foam.id },
        update: { boardFeetOnHand: t.qty_available ?? 0, lastUpdated: new Date() },
        create: { foamId: foam.id, boardFeetOnHand: t.qty_available ?? 0 },
      });
    }
  }
  // Dacron: link by name match only (units differ in Odoo: ft of a 66" roll)
  const dacrons = await odoo.searchRead('product.template', [['name', 'ilike', 'dacron'], ['default_code', '!=', false]], ['id', 'name', 'product_variant_ids', 'standard_price']);
  for (const d of dacrons) {
    const name = d.name.replace(/^\[[^\]]+\]\s*/, '').trim();
    const existing = await prisma.dacron.findFirst({ where: { OR: [{ odooTemplateId: d.id }, { name }] } });
    if (existing) await prisma.dacron.update({ where: { id: existing.id }, data: { odooTemplateId: d.id, odooProductId: d.product_variant_ids?.[0] ?? null } });
    else await prisma.dacron.create({ data: { name, weightOz: 1.5, thicknessInches: 0.5, costPerSqFt: 0.2, odooTemplateId: d.id, odooProductId: d.product_variant_ids?.[0] ?? null, description: `Odoo ${d.name}` } });
  }
  await setSetting('odoo.materialsSyncedAt', new Date().toISOString());
  return { created, updated, total: templates.length, dacrons: dacrons.length };
}

// ---------------------------------------------------------------------------
// SKUs + their current foam lines in Odoo
// ---------------------------------------------------------------------------
export async function syncSkus(opts: { includeArchived?: boolean } = {}) {
  const all = await odoo.searchRead(
    'product.template',
    [['name', 'not ilike', '[ACPPARTS]']],
    ['id', 'name', 'categ_id', 'active', 'write_date'],
    { limit: 20000, context: { active_test: false } }
  );
  const templates = all.filter((t: any) => SKU_NAME_RE.test(t.name) && (opts.includeArchived || t.active));
  const tids = templates.map((t: any) => t.id);

  const boms: any[] = [];
  for (let i = 0; i < tids.length; i += 500) {
    boms.push(...(await odoo.searchRead('mrp.bom', [['product_tmpl_id', 'in', tids.slice(i, i + 500)], ['type', '=', 'normal']], ['id', 'product_tmpl_id', 'product_id', 'active'], { limit: 20000, context: { active_test: false } })));
  }
  const bomByTmpl = new Map<number, any>();
  for (const b of boms) {
    const tid = b.product_tmpl_id[0];
    const cur = bomByTmpl.get(tid);
    // Prefer active, template-level (product_id false) BOMs.
    const score = (x: any) => (x.active ? 2 : 0) + (x.product_id ? 0 : 1);
    if (!cur || score(b) > score(cur)) bomByTmpl.set(tid, b);
  }

  const foams = await prisma.foam.findMany({ where: { odooProductId: { not: null } } });
  const foamByProduct = new Map(foams.map((f) => [f.odooProductId as number, f]));
  const bomIds = [...bomByTmpl.values()].map((b) => b.id);
  const foamLines: any[] = [];
  for (let i = 0; i < bomIds.length; i += 300) {
    foamLines.push(...(await odoo.searchRead('mrp.bom.line', [['bom_id', 'in', bomIds.slice(i, i + 300)], ['product_id', 'in', [...foamByProduct.keys()]]], ['id', 'bom_id', 'product_id', 'product_qty', 'product_uom_id'], { limit: 50000 })));
  }
  const linesByBom = new Map<number, any[]>();
  for (const l of foamLines) linesByBom.set(l.bom_id[0], [...(linesByBom.get(l.bom_id[0]) ?? []), l]);

  let created = 0, updated = 0;
  for (const t of templates) {
    const parsed = parseSkuName(t.name)!;
    const bom = bomByTmpl.get(t.id);
    const lines = (bom ? linesByBom.get(bom.id) ?? [] : []).map((l: any) => ({
      lineId: l.id,
      productId: l.product_id[0],
      templateId: foamByProduct.get(l.product_id[0])?.odooTemplateId ?? null,
      foamId: foamByProduct.get(l.product_id[0])?.id ?? null,
      name: l.product_id[1],
      qty: l.product_qty,
      uom: l.product_uom_id[1],
    }));
    const data = {
      code: parsed.code,
      name: t.name,
      shortName: parsed.shortName,
      collection: collectionFromCategory(t.categ_id),
      active: !!t.active,
      odooBomId: bom?.id ?? null,
      odooFoamLines: lines,
      lastSyncedAt: new Date(),
    };
    const existing = await prisma.sku.findUnique({ where: { odooTemplateId: t.id } });
    if (existing) {
      await prisma.sku.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.sku.create({ data: { ...data, odooTemplateId: t.id } });
      created++;
    }
  }
  await setSetting('odoo.skusSyncedAt', new Date().toISOString());
  return { created, updated, total: templates.length, withFoamLines: linesByBom.size };
}

// ---------------------------------------------------------------------------
// Foam BOM computation + push
// ---------------------------------------------------------------------------
export interface FoamTotal {
  foamId: number;
  grade: string;
  odooProductId: number | null;
  odooTemplateId: number | null;
  netBoardFeet: number;
  boardFeet: number; // with waste
  pieces: number;
}

export async function computeSkuFoam(skuId: number): Promise<{ totals: FoamTotal[]; wastePct: number; dacronSqFt: number }> {
  const sku = await prisma.sku.findUnique({ where: { id: skuId }, include: { pieces: { include: { foam: true } } } });
  if (!sku) throw new Error('SKU not found');
  const wastePct = sku.wastePct ?? (await getSetting<number>('foam.wastePct', DEFAULT_WASTE_PCT));
  const byFoam = new Map<number, FoamTotal>();
  let dacronSqFt = 0;
  for (const p of sku.pieces) {
    if (p.wrapDacron) {
      const l = p.lengthIn, w = p.widthIn, h = p.heightIn;
      dacronSqFt += ((2 * l * w + 2 * (l + w) * h) / 144) * p.qty;
    }
    if (!p.foam) continue;
    const bf = calculateBoardFeet(p.lengthIn, p.widthIn, p.heightIn) * p.qty;
    const t = byFoam.get(p.foam.id) ?? { foamId: p.foam.id, grade: p.foam.grade, odooProductId: p.foam.odooProductId, odooTemplateId: p.foam.odooTemplateId, netBoardFeet: 0, boardFeet: 0, pieces: 0 };
    t.netBoardFeet += bf;
    t.pieces += p.qty;
    byFoam.set(p.foam.id, t);
  }
  const totals = [...byFoam.values()].map((t) => ({ ...t, netBoardFeet: round2(t.netBoardFeet), boardFeet: round2(t.netBoardFeet * (1 + wastePct / 100)) }));
  return { totals, wastePct, dacronSqFt: round2(dacronSqFt) };
}

/** Replace the foam lines on the SKU's active Odoo BOM with this app's totals (BF). */
export async function pushSkuBom(skuId: number) {
  if (!odooConfigured()) throw new Error('Odoo is not configured');
  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) throw new Error('SKU not found');
  const { totals } = await computeSkuFoam(skuId);
  const foams = await prisma.foam.findMany({ where: { odooProductId: { not: null } } });
  const foamProductIds = foams.map((f) => f.odooProductId as number);

  let bomId = sku.odooBomId;
  if (!bomId) {
    bomId = await odoo.create('mrp.bom', { product_tmpl_id: sku.odooTemplateId, type: 'normal', product_qty: 1 });
    await prisma.sku.update({ where: { id: sku.id }, data: { odooBomId: bomId } });
  }
  const existing = await odoo.searchRead('mrp.bom.line', [['bom_id', '=', bomId], ['product_id', 'in', foamProductIds]], ['id', 'product_id', 'product_qty', 'product_uom_id']);
  const byProduct = new Map<number, any>(existing.map((l: any) => [l.product_id[0], l]));
  const bfUom = (await odoo.searchRead('uom.uom', [['name', '=', 'BF']], ['id'], { limit: 1 }))[0]?.id;

  const result: { product: string; qty: number; action: string }[] = [];
  const keep = new Set<number>();
  for (const t of totals) {
    if (!t.odooProductId || t.boardFeet <= 0) continue;
    keep.add(t.odooProductId);
    const line = byProduct.get(t.odooProductId);
    if (line) {
      if (Math.abs(line.product_qty - t.boardFeet) > 0.005 || (bfUom && line.product_uom_id[0] !== bfUom)) {
        await odoo.write('mrp.bom.line', [line.id], { product_qty: t.boardFeet, ...(bfUom ? { product_uom_id: bfUom } : {}) });
        result.push({ product: t.grade, qty: t.boardFeet, action: 'updated' });
      } else result.push({ product: t.grade, qty: t.boardFeet, action: 'unchanged' });
    } else {
      await odoo.create('mrp.bom.line', { bom_id: bomId, product_id: t.odooProductId, product_qty: t.boardFeet, ...(bfUom ? { product_uom_id: bfUom } : {}) });
      result.push({ product: t.grade, qty: t.boardFeet, action: 'created' });
    }
  }
  const stale = existing.filter((l: any) => !keep.has(l.product_id[0]));
  if (stale.length) {
    await odoo.unlink('mrp.bom.line', stale.map((l: any) => l.id));
    for (const l of stale) result.push({ product: l.product_id[1], qty: 0, action: 'removed' });
  }
  const lines = await odoo.searchRead('mrp.bom.line', [['bom_id', '=', bomId], ['product_id', 'in', foamProductIds]], ['id', 'product_id', 'product_qty', 'product_uom_id']);
  await prisma.sku.update({
    where: { id: sku.id },
    data: {
      pushedAt: new Date(),
      odooFoamLines: lines.map((l: any) => ({ lineId: l.id, productId: l.product_id[0], foamId: foams.find((f) => f.odooProductId === l.product_id[0])?.id ?? null, name: l.product_id[1], qty: l.product_qty, uom: l.product_uom_id[1] })),
    },
  });
  return { bomId, result };
}

// ---------------------------------------------------------------------------
// Open manufacturing orders for SKUs (foam orders are built from these)
// ---------------------------------------------------------------------------
export async function fetchOpenMos(opts: { states?: string[]; limit?: number } = {}) {
  const states = opts.states ?? ['confirmed', 'progress'];
  const mos = await odoo.searchRead(
    'mrp.production',
    [['state', 'in', states], ['product_id.name', 'not ilike', '[ACPPARTS]']],
    ['id', 'name', 'product_id', 'product_tmpl_id', 'product_qty', 'state', 'date_start', 'origin', 'date_finished'],
    { limit: opts.limit ?? 2000, order: 'date_start asc, id asc' }
  );
  const tmplIds = [...new Set(mos.map((m: any) => m.product_tmpl_id[0]))] as number[];
  const skus = await prisma.sku.findMany({ where: { odooTemplateId: { in: tmplIds } }, include: { _count: { select: { pieces: true } } } });
  const skuByTmpl = new Map(skus.map((s) => [s.odooTemplateId, s]));
  return mos.map((m: any) => {
    const s = skuByTmpl.get(m.product_tmpl_id[0]);
    return {
      moId: m.id,
      moName: m.name,
      product: m.product_id[1],
      templateId: m.product_tmpl_id[0],
      qty: m.product_qty,
      state: m.state,
      dateStart: m.date_start,
      origin: m.origin,
      skuId: s?.id ?? null,
      code: s?.code ?? null,
      hasPattern: !!s && s._count.pieces > 0,
    };
  });
}

/** Draft RFQ to the foam vendor for the order's shortfall (or full requirement). */
export async function createFoamRfq(orderId: number, opts: { full?: boolean } = {}) {
  const order = await prisma.foamOrder.findUnique({ where: { id: orderId } });
  if (!order || !order.requirements) throw new Error('Order has no requirements yet — optimize first');
  const vendorId = await getSetting<number>('odoo.foamVendorId', DEFAULT_VENDOR_ID);
  const reqs = order.requirements as any[];
  const orderLines: unknown[] = [];
  for (const r of reqs) {
    const qty = opts.full ? r.boardFeet : Math.max(0, r.shortfall);
    if (!r.odooProductId || qty <= 0) continue;
    orderLines.push([0, 0, { product_id: r.odooProductId, product_qty: round2(qty), name: r.grade }]);
  }
  if (!orderLines.length) throw new Error('Nothing to order — no shortfall');
  const poId = await odoo.create('purchase.order', { partner_id: vendorId, origin: `Foam order ${order.name}`, order_line: orderLines });
  const [po] = await odoo.read('purchase.order', [poId], ['name']);
  await prisma.foamOrder.update({ where: { id: orderId }, data: { odooPoId: poId, odooPoName: po.name, status: 'ordered' } });
  return { poId, poName: po.name, lines: orderLines.length };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Hourly background sync
// ---------------------------------------------------------------------------
let timer: NodeJS.Timeout | null = null;
export function startOdooSyncLoop() {
  if (timer || !odooConfigured()) return;
  const minutes = Number(process.env.ODOO_SYNC_INTERVAL_MIN) || 60;
  const run = async () => {
    try {
      const m = await syncFoamMaterials();
      const s = await syncSkus();
      console.log(`[odoo-sync] materials ${m.total} · skus ${s.total} (${s.created} new)`);
    } catch (e) {
      console.error('[odoo-sync] failed', e);
    }
  };
  setTimeout(run, 20_000);
  timer = setInterval(run, minutes * 60_000);
}
