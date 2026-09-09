-- AlterTable
ALTER TABLE "FoamOrder" ADD COLUMN "remnantCuts" JSONB;

-- CreateTable
CREATE TABLE "Remnant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "foamId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'cut',
    "status" TEXT NOT NULL DEFAULT 'available',
    "lengthIn" REAL NOT NULL,
    "widthIn" REAL NOT NULL,
    "shapeType" TEXT NOT NULL DEFAULT 'rect',
    "shape" JSONB,
    "areaSqIn" REAL NOT NULL,
    "foamOrderId" INTEGER,
    "scheduleNumber" TEXT,
    "slabIndex" INTEGER,
    "parentId" INTEGER,
    "usedOrderId" INTEGER,
    "usedFor" JSONB,
    "usedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Remnant_foamId_fkey" FOREIGN KEY ("foamId") REFERENCES "Foam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Remnant_foamId_status_idx" ON "Remnant"("foamId", "status");

-- CreateIndex
CREATE INDEX "Remnant_foamOrderId_foamId_slabIndex_idx" ON "Remnant"("foamOrderId", "foamId", "slabIndex");
