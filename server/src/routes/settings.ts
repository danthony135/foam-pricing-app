import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// Labor settings
router.get('/labor', async (_req, res, next) => {
  try {
    const settings = await prisma.laborSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {},
    });
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/labor', async (req, res, next) => {
  try {
    const settings = await prisma.laborSettings.upsert({
      where: { id: 1 },
      update: req.body,
      create: req.body,
    });
    res.json(settings);
  } catch (err) { next(err); }
});

// Overhead settings
router.get('/overhead', async (_req, res, next) => {
  try {
    const settings = await prisma.overheadSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {},
    });
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/overhead', async (req, res, next) => {
  try {
    const settings = await prisma.overheadSettings.upsert({
      where: { id: 1 },
      update: req.body,
      create: req.body,
    });
    res.json(settings);
  } catch (err) { next(err); }
});

export default router;
