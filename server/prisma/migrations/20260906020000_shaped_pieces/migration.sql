-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FoamPiece" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "skuId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "foamId" INTEGER,
    "lengthIn" REAL NOT NULL,
    "widthIn" REAL NOT NULL,
    "heightIn" REAL NOT NULL,
    "shapeType" TEXT NOT NULL DEFAULT 'rect',
    "shape" JSONB,
    "areaSqIn" REAL,
    "shapeSource" TEXT,
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
INSERT INTO "new_FoamPiece" ("createdAt", "dacronId", "foamId", "heightIn", "id", "lengthIn", "name", "notes", "qty", "skuId", "sortOrder", "updatedAt", "widthIn", "wrapDacron") SELECT "createdAt", "dacronId", "foamId", "heightIn", "id", "lengthIn", "name", "notes", "qty", "skuId", "sortOrder", "updatedAt", "widthIn", "wrapDacron" FROM "FoamPiece";
DROP TABLE "FoamPiece";
ALTER TABLE "new_FoamPiece" RENAME TO "FoamPiece";
CREATE INDEX "FoamPiece_skuId_idx" ON "FoamPiece"("skuId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

