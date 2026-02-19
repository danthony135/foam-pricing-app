import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// Foam inventory
router.get('/foam', async (_req, res, next) => {
  try {
    const inventory = await prisma.foamInventory.findMany({
      include: { foam: true },
      orderBy: { foam: { grade: 'asc' } },
    });
    res.json(inventory);
  } catch (err) { next(err); }
});

router.post('/foam', async (req, res, next) => {
  try {
    const inv = await prisma.foamInventory.upsert({
      where: { foamId: req.body.foamId },
      update: {
        boardFeetOnHand: req.body.boardFeetOnHand,
        lowStockThreshold: req.body.lowStockThreshold,
        lastUpdated: new Date(),
      },
      create: req.body,
    });
    res.json(inv);
  } catch (err) { next(err); }
});

router.get('/foam/low-stock', async (_req, res, next) => {
  try {
    const alerts = await prisma.foamInventory.findMany({
      where: { boardFeetOnHand: { lte: prisma.foamInventory.fields.lowStockThreshold } },
      include: { foam: true },
    });
    // Prisma doesn't support field-to-field comparison in where, so filter in JS
    const allInv = await prisma.foamInventory.findMany({ include: { foam: true } });
    const lowStock = allInv.filter(i => i.boardFeetOnHand <= i.lowStockThreshold);
    res.json(lowStock);
  } catch (err) { next(err); }
});

// Dacron inventory
router.get('/dacron', async (_req, res, next) => {
  try {
    const inventory = await prisma.dacronInventory.findMany({
      include: { dacron: true },
      orderBy: { dacron: { name: 'asc' } },
    });
    res.json(inventory);
  } catch (err) { next(err); }
});

router.post('/dacron', async (req, res, next) => {
  try {
    const inv = await prisma.dacronInventory.upsert({
      where: { dacronId: req.body.dacronId },
      update: {
        sqFtOnHand: req.body.sqFtOnHand,
        rollsOnHand: req.body.rollsOnHand,
        lowStockThreshold: req.body.lowStockThreshold,
        lastUpdated: new Date(),
      },
      create: req.body,
    });
    res.json(inv);
  } catch (err) { next(err); }
});

router.get('/dacron/low-stock', async (_req, res, next) => {
  try {
    const allInv = await prisma.dacronInventory.findMany({ include: { dacron: true } });
    const lowStock = allInv.filter(i => i.sqFtOnHand <= i.lowStockThreshold);
    res.json(lowStock);
  } catch (err) { next(err); }
});

export default router;
