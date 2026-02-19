import { calculateBoardFeet, calculateDacronSqFt } from '../utils/boardFeet';

export interface PricingInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  foamCostPerBF: number;
  foamTolerancePct: number;
  dacronCostPerSqFt?: number;
  dacronTolerancePct?: number;
  makeTimeMin: number;
  hourlyRate: number;
  facilityOverheadPct: number;
  indirectLaborPct: number;
  markupPct: number;
  shippingCostPerBF: number;
  quantity: number;
}

export interface PricingBreakdown {
  boardFeet: number;
  dacronSqFt: number | null;
  foamMaterialCost: number;
  dacronMaterialCost: number;
  totalMaterialCost: number;
  laborCost: number;
  materialPlusLabor: number;
  overheadAmount: number;
  afterOverhead: number;
  indirectLaborAmount: number;
  subtotal: number;
  markupAmount: number;
  afterMarkup: number;
  shippingCost: number;
  unitPrice: number;
  totalPrice: number;
}

export function calculatePrice(input: PricingInput): PricingBreakdown {
  const boardFeet = calculateBoardFeet(input.lengthIn, input.widthIn, input.heightIn, input.foamTolerancePct);
  const dacronSqFt = input.dacronCostPerSqFt != null
    ? calculateDacronSqFt(input.lengthIn, input.widthIn, input.heightIn, input.dacronTolerancePct || 0)
    : null;

  const foamMaterialCost = boardFeet * input.foamCostPerBF;
  const dacronMaterialCost = dacronSqFt != null ? dacronSqFt * (input.dacronCostPerSqFt || 0) : 0;
  const totalMaterialCost = foamMaterialCost + dacronMaterialCost;

  const laborCost = (input.makeTimeMin / 60) * input.hourlyRate;
  const materialPlusLabor = totalMaterialCost + laborCost;

  const overheadAmount = materialPlusLabor * (input.facilityOverheadPct / 100);
  const afterOverhead = materialPlusLabor + overheadAmount;

  const indirectLaborAmount = afterOverhead * (input.indirectLaborPct / 100);
  const subtotal = afterOverhead + indirectLaborAmount;

  const markupAmount = subtotal * (input.markupPct / 100);
  const afterMarkup = subtotal + markupAmount;

  const shippingCost = boardFeet * input.shippingCostPerBF;
  const unitPrice = afterMarkup + shippingCost;
  const totalPrice = unitPrice * input.quantity;

  return {
    boardFeet: round(boardFeet),
    dacronSqFt: dacronSqFt != null ? round(dacronSqFt) : null,
    foamMaterialCost: round(foamMaterialCost),
    dacronMaterialCost: round(dacronMaterialCost),
    totalMaterialCost: round(totalMaterialCost),
    laborCost: round(laborCost),
    materialPlusLabor: round(materialPlusLabor),
    overheadAmount: round(overheadAmount),
    afterOverhead: round(afterOverhead),
    indirectLaborAmount: round(indirectLaborAmount),
    subtotal: round(subtotal),
    markupAmount: round(markupAmount),
    afterMarkup: round(afterMarkup),
    shippingCost: round(shippingCost),
    unitPrice: round(unitPrice),
    totalPrice: round(totalPrice),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
