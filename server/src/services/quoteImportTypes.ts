/** Raw line item as parsed from any input format (Excel, email, PDF) */
export interface RawQuoteLineItem {
  customerRef: string;
  foamRef: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  quantity: number;
  dacronRef?: string;
  notes?: string;
}

/** After resolving references to DB records */
export interface ResolvedQuoteLineItem extends RawQuoteLineItem {
  customerId: number | null;
  customerName: string | null;
  foamId: number | null;
  foamGrade: string | null;
  dacronId: number | null;
  dacronName: string | null;
  errors: string[];
}

/** After running through pricing engine */
export interface PricedQuoteLineItem extends ResolvedQuoteLineItem {
  unitPrice: number;
  totalPrice: number;
  boardFeet: number;
  dacronSqFt: number | null;
  materialCost: number;
  laborCost: number;
  overheadAmount: number;
  indirectLaborAmount: number;
  subtotal: number;
  markupAmount: number;
  shippingCost: number;
  makeTimeMin: number;
  partNumber: string | null;
}
