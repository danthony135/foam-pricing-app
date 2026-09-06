-- CreateTable
CREATE TABLE "ScrapLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "foamOrderId" INTEGER NOT NULL,
    "foamId" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "scheduleNumber" TEXT,
    "slabs" INTEGER NOT NULL,
    "slabSqIn" REAL NOT NULL,
    "usedSqIn" REAL NOT NULL,
    "scrapSqIn" REAL NOT NULL,
    "scrapBF" REAL NOT NULL,
    "usedBF" REAL NOT NULL,
    "gluedPieces" INTEGER NOT NULL DEFAULT 0,
    "remnants" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ScrapLog_foamId_createdAt_idx" ON "ScrapLog"("foamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapLog_foamOrderId_foamId_key" ON "ScrapLog"("foamOrderId", "foamId");

