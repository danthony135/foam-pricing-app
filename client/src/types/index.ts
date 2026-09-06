export interface Foam {
  id: number;
  grade: string;
  density: number;
  ild: number | null;
  costPerBoardFoot: number;
  supplier: string | null;
  description: string | null;
  odooTemplateId?: number | null;
  odooProductId?: number | null;
  thicknessIn?: number | null;
  sheetLengthIn?: number;
  sheetWidthIn?: number;
  active?: boolean;
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

export interface Sku {
  id: number;
  odooTemplateId: number;
  code: string;
  name: string;
  shortName: string;
  collection: string;
  active: boolean;
  odooBomId: number | null;
  pieceCount: number;
  netBoardFeet: number;
  odooBoardFeet: number;
  status: 'ready' | 'partial' | 'missing';
  pushedAt: string | null;
  lastSyncedAt: string | null;
}
