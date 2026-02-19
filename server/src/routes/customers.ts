import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    res.json(customers);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: +req.params.id },
      include: {
        foamPricing: { include: { foam: true } },
        partNumberTemplate: true,
        quotes: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const customer = await prisma.customer.create({ data: req.body });
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({ where: { id: +req.params.id }, data: req.body });
    res.json(customer);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.customer.delete({ where: { id: +req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Customer foam pricing overrides
router.get('/:id/foam-pricing', async (req, res, next) => {
  try {
    const pricing = await prisma.customerFoamPricing.findMany({
      where: { customerId: +req.params.id },
      include: { foam: true },
    });
    res.json(pricing);
  } catch (err) { next(err); }
});

router.post('/:id/foam-pricing', async (req, res, next) => {
  try {
    const pricing = await prisma.customerFoamPricing.upsert({
      where: {
        customerId_foamId: { customerId: +req.params.id, foamId: req.body.foamId },
      },
      update: { overrideCostPerBF: req.body.overrideCostPerBF, overrideMarkup: req.body.overrideMarkup },
      create: {
        customerId: +req.params.id,
        foamId: req.body.foamId,
        overrideCostPerBF: req.body.overrideCostPerBF,
        overrideMarkup: req.body.overrideMarkup,
      },
    });
    res.json(pricing);
  } catch (err) { next(err); }
});

router.delete('/:id/foam-pricing/:foamId', async (req, res, next) => {
  try {
    await prisma.customerFoamPricing.delete({
      where: {
        customerId_foamId: { customerId: +req.params.id, foamId: +req.params.foamId },
      },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Part number template
router.get('/:id/part-template', async (req, res, next) => {
  try {
    const template = await prisma.partNumberTemplate.findUnique({
      where: { customerId: +req.params.id },
    });
    res.json(template || { template: '{customer_code}-{foam_grade}-{L}x{W}x{H}' });
  } catch (err) { next(err); }
});

router.put('/:id/part-template', async (req, res, next) => {
  try {
    const template = await prisma.partNumberTemplate.upsert({
      where: { customerId: +req.params.id },
      update: { template: req.body.template },
      create: { customerId: +req.params.id, template: req.body.template },
    });
    res.json(template);
  } catch (err) { next(err); }
});

export default router;
