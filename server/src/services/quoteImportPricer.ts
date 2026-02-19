import type { ResolvedQuoteLineItem, PricedQuoteLineItem } from './quoteImportTypes';
import { resolvePricingContext, buildPricingInput } from './pricingResolver';
import { calculatePrice } from './pricingEngine';
import { generatePartNumber } from './partNumberGenerator';
import { prisma } from '../index';

export async function priceItems(items: ResolvedQuoteLineItem[]): Promise<PricedQuoteLineItem[]> {
  const results: PricedQuoteLineItem[] = [];

  for (const item of items) {
    if (item.errors.length > 0 || !item.customerId || !item.foamId) {
      // Can't price items with unresolved references
      results.push({
        ...item,
        unitPrice: 0,
        totalPrice: 0,
        boardFeet: 0,
        dacronSqFt: null,
        materialCost: 0,
        laborCost: 0,
        overheadAmount: 0,
        indirectLaborAmount: 0,
        subtotal: 0,
        markupAmount: 0,
        shippingCost: 0,
        makeTimeMin: 0,
        partNumber: null,
      });
      continue;
    }

    const ctx = await resolvePricingContext(item.foamId, item.customerId, item.dacronId);
    const input = buildPricingInput(ctx, {
      lengthIn: item.lengthIn,
      widthIn: item.widthIn,
      heightIn: item.heightIn,
      quantity: item.quantity,
    });
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
          L: String(item.lengthIn),
          W: String(item.widthIn),
          H: String(item.heightIn),
          density: String(ctx.foam.density),
          dacron: ctx.dacron?.name || '',
          quantity: String(item.quantity),
        },
      );
    }

    results.push({
      ...item,
      unitPrice: breakdown.unitPrice,
      totalPrice: breakdown.totalPrice,
      boardFeet: breakdown.boardFeet,
      dacronSqFt: breakdown.dacronSqFt,
      materialCost: breakdown.totalMaterialCost,
      laborCost: breakdown.laborCost,
      overheadAmount: breakdown.overheadAmount,
      indirectLaborAmount: breakdown.indirectLaborAmount,
      subtotal: breakdown.subtotal,
      markupAmount: breakdown.markupAmount,
      shippingCost: breakdown.shippingCost,
      makeTimeMin: input.makeTimeMin,
      partNumber,
    });
  }

  return results;
}
