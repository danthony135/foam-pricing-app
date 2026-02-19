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
    const quote = await prisma.cushionQuote.create({ data: req.body });
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
