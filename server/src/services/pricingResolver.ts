import { prisma } from '../index';
import { calculatePrice, PricingInput, PricingBreakdown } from './pricingEngine';
import { generatePartNumber } from './partNumberGenerator';

export interface ResolvedPricingContext {
  foam: { id: number; grade: string; costPerBoardFoot: number; density: number };
  customer: { id: number; name: string; code: string; shippingCostPerBF: number; markupPercent: number } | null;
  dacron: { id: number; name: string; costPerSqFt: number } | null;
  labor: { defaultMakeTimeMin: number; avgHourlyRate: number };
  overhead: { facilityOverheadPercent: number; indirectLaborPercent: number; defaultMarkupPercent: number };
  foamCostPerBF: number;
  markupPct: number;
}

/** Fetch all DB records needed for pricing, including customer-specific overrides */
export async function resolvePricingContext(
  foamId: number,
  customerId?: number | null,
  dacronId?: number | null,
): Promise<ResolvedPricingContext> {
  const [foam, customer, labor, overhead] = await Promise.all([
    prisma.foam.findUniqueOrThrow({ where: { id: foamId } }),
    customerId ? prisma.customer.findUnique({ where: { id: customerId } }) : null,
    prisma.laborSettings.upsert({ where: { id: 1 }, update: {}, create: {} }),
    prisma.overheadSettings.upsert({ where: { id: 1 }, update: {}, create: {} }),
  ]);

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

  return { foam, customer, dacron, labor, overhead, foamCostPerBF, markupPct };
}

/** Build PricingInput from resolved context + dimensions */
export function buildPricingInput(
  ctx: ResolvedPricingContext,
  dims: { lengthIn: number; widthIn: number; heightIn: number; quantity?: number; makeTimeMin?: number; foamTolerancePct?: number; dacronTolerancePct?: number },
): PricingInput {
  return {
    lengthIn: dims.lengthIn,
    widthIn: dims.widthIn,
    heightIn: dims.heightIn,
    foamCostPerBF: ctx.foamCostPerBF,
    foamTolerancePct: dims.foamTolerancePct ?? 0,
    dacronCostPerSqFt: ctx.dacron?.costPerSqFt,
    dacronTolerancePct: dims.dacronTolerancePct ?? 0,
    makeTimeMin: dims.makeTimeMin ?? ctx.labor.defaultMakeTimeMin,
    hourlyRate: ctx.labor.avgHourlyRate,
    facilityOverheadPct: ctx.overhead.facilityOverheadPercent,
    indirectLaborPct: ctx.overhead.indirectLaborPercent,
    markupPct: ctx.markupPct,
    shippingCostPerBF: ctx.customer?.shippingCostPerBF ?? 0,
    quantity: dims.quantity ?? 1,
  };
}

/** Full calculate with part number generation */
export async function calculateWithContext(
  ctx: ResolvedPricingContext,
  dims: { lengthIn: number; widthIn: number; heightIn: number; quantity?: number; makeTimeMin?: number; foamTolerancePct?: number; dacronTolerancePct?: number },
): Promise<PricingBreakdown & { partNumber: string | null; foamGrade: string; customerCode?: string }> {
  const input = buildPricingInput(ctx, dims);
  const breakdown = calculatePrice(input);

  let partNumber: string | null = null;
  if (ctx.customer) {
    const template = await prisma.partNumberTemplate.findUnique({
      where: { customerId: ctx.customer.id },
    });
    partNumber = generatePartNumber(
      template?.template || '{customer_code}-{foam_grade}-{L}x{W}x{H}',
      {
        customer_code: ctx.customer.code,
        foam_grade: ctx.foam.grade,
        L: String(dims.lengthIn),
        W: String(dims.widthIn),
        H: String(dims.heightIn),
        density: String(ctx.foam.density),
        dacron: ctx.dacron?.name || '',
        quantity: String(dims.quantity ?? 1),
      },
    );
  }

  return { ...breakdown, partNumber, foamGrade: ctx.foam.grade, customerCode: ctx.customer?.code };
}
