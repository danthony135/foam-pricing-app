export interface Foam {
  id: number;
  grade: string;
  density: number;
  ild: number | null;
  costPerBoardFoot: number;
  supplier: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dacron {
  id: number;
  name: string;
  weightOz: number;
  thicknessInches: number;
  costPerSqFt: number;
  supplier: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  code: string;
  shippingCostPerBF: number;
  markupPercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  foamPricing?: CustomerFoamPricing[];
  partNumberTemplate?: PartNumberTemplate | null;
  quotes?: CushionQuote[];
}

export interface CustomerFoamPricing {
  id: number;
  customerId: number;
  foamId: number;
  overrideCostPerBF: number | null;
  overrideMarkup: number | null;
  foam?: Foam;
}

export interface PartNumberTemplate {
  id: number;
  customerId: number;
  template: string;
}

export interface FoamInventory {
  id: number;
  foamId: number;
  boardFeetOnHand: number;
  lowStockThreshold: number;
  lastUpdated: string;
  foam?: Foam;
}

export interface DacronInventory {
  id: number;
  dacronId: number;
  sqFtOnHand: number;
  rollsOnHand: number;
  lowStockThreshold: number;
  lastUpdated: string;
  dacron?: Dacron;
}

export interface LaborSettings {
  id: number;
  defaultMakeTimeMin: number;
  avgHourlyRate: number;
}

export interface OverheadSettings {
  id: number;
  facilityOverheadPercent: number;
  indirectLaborPercent: number;
  defaultMarkupPercent: number;
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
  partNumber: string | null;
  foamGrade?: string;
  customerCode?: string;
}

export interface CushionQuote {
  id: number;
  customerId: number;
  foamId: number;
  dacronId: number | null;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  foamTolerancePct: number;
  dacronTolerancePct: number;
  quantity: number;
  makeTimeMin: number;
  boardFeet: number;
  dacronSqFt: number | null;
  materialCost: number;
  laborCost: number;
  overheadAmount: number;
  indirectLaborAmount: number;
  subtotal: number;
  markupAmount: number;
  shippingCost: number;
  unitPrice: number;
  totalPrice: number;
  partNumber: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  foam?: Foam;
  dacron?: Dacron | null;
}

export interface PricingRule {
  id: number;
  name: string;
  ruleType: string;
  conditions: any;
  actions: any;
  priority: number;
  isActive: boolean;
}

export interface AiChatMessage {
  id: number;
  role: string;
  content: string;
  toolCalls?: any;
  createdAt: string;
}
