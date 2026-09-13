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
    "sheetLengthIn" REAL NOT NULL DEFAULT 108,
    "sheetWidthIn" REAL NOT NULL DEFAULT 84,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Foam" ("active", "costPerBoardFoot", "createdAt", "density", "description", "grade", "id", "ild", "odooProductId", "odooTemplateId", "sheetLengthIn", "sheetWidthIn", "supplier", "thicknessIn", "updatedAt") SELECT "active", "costPerBoardFoot", "createdAt", "density", "description", "grade", "id", "ild", "odooProductId", "odooTemplateId", "sheetLengthIn", "sheetWidthIn", "supplier", "thicknessIn", "updatedAt" FROM "Foam";
DROP TABLE "Foam";
ALTER TABLE "new_Foam" RENAME TO "Foam";
CREATE UNIQUE INDEX "Foam_grade_key" ON "Foam"("grade");
CREATE UNIQUE INDEX "Foam_odooTemplateId_key" ON "Foam"("odooTemplateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- The 82 x 36 rows were the old placeholder default; we buy 108 x 84 slabs. Sizes set on purpose are left alone.
UPDATE "Foam" SET "sheetLengthIn" = 108, "sheetWidthIn" = 84 WHERE "sheetLengthIn" = 82 AND "sheetWidthIn" = 36;
