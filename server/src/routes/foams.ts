import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const foams = await prisma.foam.findMany({ orderBy: { grade: 'asc' } });
    res.json(foams);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const foam = await prisma.foam.findUnique({ where: { id: +req.params.id } });
    if (!foam) return res.status(404).json({ error: 'Foam not found' });
    res.json(foam);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const foam = await prisma.foam.create({ data: req.body });
    res.status(201).json(foam);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const foam = await prisma.foam.update({ where: { id: +req.params.id }, data: req.body });
    res.json(foam);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.foam.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
