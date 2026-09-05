-- AlterTable
ALTER TABLE "Dacron" ADD COLUMN "odooProductId" INTEGER;
ALTER TABLE "Dacron" ADD COLUMN "odooTemplateId" INTEGER;

-- CreateTable
CREATE TABLE "Sku" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "odooTemplateId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "collection" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "odooBomId" INTEGER,
    "odooFoamLines" JSONB,
    "wastePct" REAL,
    "notes" TEXT,
    "lastSyncedAt" DATETIME,
    "pushedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FoamPiece" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "skuId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "foamId" INTEGER,
    "lengthIn" REAL NOT NULL,
    "widthIn" REAL NOT NULL,
    "heightIn" REAL NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "dacronId" INTEGER,
    "wrapDacron" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoamPiece_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoamPiece_foamId_fkey" FOREIGN KEY ("foamId") REFERENCES "Foam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FoamPiece_dacronId_fkey" FOREIGN KEY ("dacronId") REFERENCES "Dacron" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoamOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "lines" JSONB NOT NULL,
    "requirements" JSONB,
    "cutPlan" JSONB,
    "odooPoId" INTEGER,
    "odooPoName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Foam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "grade" TEXT NOT NULL,
    "density" REAL NOT NULL,
    "ild" REAL,
    "costPerBoardFoot" REAL NOT NULL,
    "supplier" TEXT,
    "description" TEXT,
    "odooTemplateId" INTEGER,
    "odooProductId" INTEGER,
    "thicknessIn" REAL,
    "sheetLengthIn" REAL NOT NULL DEFAULT 82,
    "sheetWidthIn" REAL NOT NULL DEFAULT 36,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Foam" ("costPerBoardFoot", "createdAt", "density", "description", "grade", "id", "ild", "supplier", "updatedAt") SELECT "costPerBoardFoot", "createdAt", "density", "description", "grade", "id", "ild", "supplier", "updatedAt" FROM "Foam";
DROP TABLE "Foam";
ALTER TABLE "new_Foam" RENAME TO "Foam";
CREATE UNIQUE INDEX "Foam_grade_key" ON "Foam"("grade");
CREATE UNIQUE INDEX "Foam_odooTemplateId_key" ON "Foam"("odooTemplateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Sku_odooTemplateId_key" ON "Sku"("odooTemplateId");

-- CreateIndex
CREATE INDEX "Sku_code_idx" ON "Sku"("code");

-- CreateIndex
CREATE INDEX "Sku_collection_idx" ON "Sku"("collection");

-- CreateIndex
CREATE INDEX "FoamPiece_skuId_idx" ON "FoamPiece"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Dacron_odooTemplateId_key" ON "Dacron"("odooTemplateId");

