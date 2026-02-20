import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, customerId } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = +customerId;

    const quotes = await prisma.cushionQuote.findMany({
      where,
      include: { customer: true, foam: true, dacron: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotes);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quote = await prisma.cushionQuote.findUnique({
      where: { id: +req.params.id },
      include: { customer: true, foam: true, dacron: true },
    });
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json(quote);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const breakdown = b.breakdown || {};

    const data = {
      customerId: +(b.customerId || 0),
      foamId: +b.foamId,
      dacronId: b.dacronId ? +b.dacronId : null,
      lengthIn: b.lengthIn ?? b.length,
      widthIn: b.widthIn ?? b.width,
      heightIn: b.heightIn ?? b.height,
      foamTolerancePct: b.foamTolerancePct ?? b.foamTolerance ?? 0,
      dacronTolerancePct: b.dacronTolerancePct ?? b.dacronTolerance ?? 0,
      quantity: b.quantity ?? 1,
      makeTimeMin: b.makeTimeMin ?? b.makeTimeOverride ?? breakdown.makeTimeMin ?? 30,
      boardFeet: b.boardFeet ?? breakdown.boardFeet ?? 0,
      dacronSqFt: b.dacronSqFt ?? breakdown.dacronSqFt ?? null,
      materialCost: b.materialCost ?? breakdown.totalMaterialCost ?? 0,
      laborCost: b.laborCost ?? breakdown.laborCost ?? 0,
      overheadAmount: b.overheadAmount ?? breakdown.overheadAmount ?? 0,
      indirectLaborAmount: b.indirectLaborAmount ?? breakdown.indirectLaborAmount ?? 0,
      subtotal: b.subtotal ?? breakdown.subtotal ?? 0,
      markupAmount: b.markupAmount ?? breakdown.markupAmount ?? 0,
      shippingCost: b.shippingCost ?? breakdown.shippingCost ?? 0,
      unitPrice: b.unitPrice ?? breakdown.unitPrice ?? 0,
      totalPrice: b.totalPrice ?? breakdown.totalPrice ?? 0,
      partNumber: b.partNumber ?? breakdown.partNumber ?? null,
      status: b.status ?? 'draft',
      notes: b.notes ?? null,
    };

    const quote = await prisma.cushionQuote.create({ data, include: { customer: true, foam: true, dacron: true } });
    res.status(201).json(quote);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const quote = await prisma.cushionQuote.update({
      where: { id: +req.params.id },
      data: req.body,
    });
    res.json(quote);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.cushionQuote.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
