-- AlterTable
ALTER TABLE "FoamOrder" ADD COLUMN "cutProgress" JSONB;
ALTER TABLE "FoamOrder" ADD COLUMN "scheduleNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FoamOrder_scheduleNumber_key" ON "FoamOrder"("scheduleNumber");

