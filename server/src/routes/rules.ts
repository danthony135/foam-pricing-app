import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rules = await prisma.pricingRule.findMany({ orderBy: { priority: 'desc' } });
    res.json(rules);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const rule = await prisma.pricingRule.create({ data: req.body });
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const rule = await prisma.pricingRule.update({ where: { id: +req.params.id }, data: req.body });
    res.json(rule);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.pricingRule.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
