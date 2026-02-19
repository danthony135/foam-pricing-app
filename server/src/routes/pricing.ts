import { Router } from 'express';
import { prisma } from '../index';
import { calculatePrice, PricingInput } from '../services/pricingEngine';
import { generatePartNumber } from '../services/partNumberGenerator';

const router = Router();

router.post('/calculate', async (req, res, next) => {
  try {
    const { customerId, foamId, dacronId, lengthIn, widthIn, heightIn,
            foamTolerancePct = 0, dacronTolerancePct = 0,
            makeTimeMin, quantity = 1 } = req.body;

    const [foam, customer, labor, overhead] = await Promise.all([
      prisma.foam.findUniqueOrThrow({ where: { id: foamId } }),
      customerId ? prisma.customer.findUnique({ where: { id: customerId } }) : null,
      prisma.laborSettings.upsert({ where: { id: 1 }, update: {}, create: {} }),
      prisma.overheadSettings.upsert({ where: { id: 1 }, update: {}, create: {} }),
    ]);

    // Check for customer-specific pricing override
    let foamCostPerBF = foam.costPerBoardFoot;
    let markupPct = customer?.markupPercent ?? overhead.defaultMarkupPercent;

    if (customerId && foamId) {
      const override = await prisma.customerFoamPricing.findUnique({
        where: { customerId_foamId: { customerId, foamId } },
      });
      if (override?.overrideCostPerBF != null) foamCostPerBF = override.overrideCostPerBF;
      if (override?.overrideMarkup != null) markupPct = override.overrideMarkup;
    }

    const dacron = dacronId ? await prisma.dacron.findUnique({ where: { id: dacronId } }) : null;

    const input: PricingInput = {
      lengthIn,
      widthIn,
      heightIn,
      foamCostPerBF,
      foamTolerancePct,
      dacronCostPerSqFt: dacron?.costPerSqFt,
      dacronTolerancePct,
      makeTimeMin: makeTimeMin ?? labor.defaultMakeTimeMin,
      hourlyRate: labor.avgHourlyRate,
      facilityOverheadPct: overhead.facilityOverheadPercent,
      indirectLaborPct: overhead.indirectLaborPercent,
      markupPct,
      shippingCostPerBF: customer?.shippingCostPerBF ?? 0,
      quantity,
    };

    const breakdown = calculatePrice(input);

    // Generate part number
    let partNumber: string | null = null;
    if (customer) {
      const template = await prisma.partNumberTemplate.findUnique({
        where: { customerId: customer.id },
      });
      partNumber = generatePartNumber(
        template?.template || '{customer_code}-{foam_grade}-{L}x{W}x{H}',
        {
          customer_code: customer.code,
          foam_grade: foam.grade,
          L: String(lengthIn),
          W: String(widthIn),
          H: String(heightIn),
          density: String(foam.density),
          dacron: dacron?.name || '',
          quantity: String(quantity),
        }
      );
    }

    res.json({ ...breakdown, partNumber, foamGrade: foam.grade, customerCode: customer?.code });
  } catch (err) { next(err); }
});

export default router;
