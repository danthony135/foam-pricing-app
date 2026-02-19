import { Router } from 'express';
import { resolvePricingContext, calculateWithContext } from '../services/pricingResolver';

const router = Router();

router.post('/calculate', async (req, res, next) => {
  try {
    const { customerId, foamId, dacronId, lengthIn, widthIn, heightIn,
            foamTolerancePct = 0, dacronTolerancePct = 0,
            makeTimeMin, quantity = 1 } = req.body;

    const ctx = await resolvePricingContext(foamId, customerId, dacronId);
    const result = await calculateWithContext(ctx, {
      lengthIn, widthIn, heightIn,
      foamTolerancePct, dacronTolerancePct,
      makeTimeMin, quantity,
    });

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
