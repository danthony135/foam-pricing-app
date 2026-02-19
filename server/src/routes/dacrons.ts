import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const dacrons = await prisma.dacron.findMany({ orderBy: { name: 'asc' } });
    res.json(dacrons);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const dacron = await prisma.dacron.findUnique({ where: { id: +req.params.id } });
    if (!dacron) return res.status(404).json({ error: 'Dacron not found' });
    res.json(dacron);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const dacron = await prisma.dacron.create({ data: req.body });
    res.status(201).json(dacron);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const dacron = await prisma.dacron.update({ where: { id: +req.params.id }, data: req.body });
    res.json(dacron);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.dacron.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
