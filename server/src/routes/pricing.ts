import { Router } from 'express';
import { resolvePricingContext, calculateWithContext } from '../services/pricingResolver';

const router = Router();

router.post('/calculate', async (req, res, next) => {
  try {
    const b = req.body;
    const foamId = b.foamId;
    const customerId = b.customerId;
    const dacronId = b.dacronId;
    const lengthIn = b.lengthIn ?? b.length;
    const widthIn = b.widthIn ?? b.width;
    const heightIn = b.heightIn ?? b.height;
    const foamTolerancePct = b.foamTolerancePct ?? b.foamTolerance ?? 0;
    const dacronTolerancePct = b.dacronTolerancePct ?? b.dacronTolerance ?? 0;
    const makeTimeMin = b.makeTimeMin ?? b.makeTimeOverride;
    const quantity = b.quantity ?? 1;

    const ctx = await resolvePricingContext(
      +foamId,
      customerId ? +customerId : null,
      dacronId ? +dacronId : null,
    );
    const result = await calculateWithContext(ctx, {
      lengthIn, widthIn, heightIn,
      foamTolerancePct, dacronTolerancePct,
      makeTimeMin, quantity,
    });

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
