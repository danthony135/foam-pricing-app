-- CreateTable
CREATE TABLE "Foam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "grade" TEXT NOT NULL,
    "density" REAL NOT NULL,
    "ild" REAL,
    "costPerBoardFoot" REAL NOT NULL,
    "supplier" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dacron" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "weightOz" REAL NOT NULL,
    "thicknessInches" REAL NOT NULL,
    "costPerSqFt" REAL NOT NULL,
    "supplier" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shippingCostPerBF" REAL NOT NULL DEFAULT 0,
    "markupPercent" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomerFoamPricing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "foamId" INTEGER NOT NULL,
    "overrideCostPerBF" REAL,
    "overrideMarkup" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerFoamPricing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerFoamPricing_foamId_fkey" FOREIGN KEY ("foamId") REFERENCES "Foam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoamInventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "foamId" INTEGER NOT NULL,
    "boardFeetOnHand" REAL NOT NULL DEFAULT 0,
    "lowStockThreshold" REAL NOT NULL DEFAULT 100,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoamInventory_foamId_fkey" FOREIGN KEY ("foamId") REFERENCES "Foam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DacronInventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dacronId" INTEGER NOT NULL,
    "sqFtOnHand" REAL NOT NULL DEFAULT 0,
    "rollsOnHand" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" REAL NOT NULL DEFAULT 50,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DacronInventory_dacronId_fkey" FOREIGN KEY ("dacronId") REFERENCES "Dacron" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaborSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "defaultMakeTimeMin" REAL NOT NULL DEFAULT 30,
    "avgHourlyRate" REAL NOT NULL DEFAULT 25,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OverheadSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "facilityOverheadPercent" REAL NOT NULL DEFAULT 15,
    "indirectLaborPercent" REAL NOT NULL DEFAULT 10,
    "defaultMarkupPercent" REAL NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PartNumberTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "template" TEXT NOT NULL DEFAULT '{customer_code}-{foam_grade}-{L}x{W}x{H}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartNumberTemplate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL DEFAULT 'manual',
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CushionQuote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "foamId" INTEGER NOT NULL,
    "dacronId" INTEGER,
    "lengthIn" REAL NOT NULL,
    "widthIn" REAL NOT NULL,
    "heightIn" REAL NOT NULL,
    "foamTolerancePct" REAL NOT NULL DEFAULT 0,
    "dacronTolerancePct" REAL NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "makeTimeMin" REAL NOT NULL,
    "boardFeet" REAL NOT NULL,
    "dacronSqFt" REAL,
    "materialCost" REAL NOT NULL,
    "laborCost" REAL NOT NULL,
    "overheadAmount" REAL NOT NULL,
    "indirectLaborAmount" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "markupAmount" REAL NOT NULL,
    "shippingCost" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "partNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CushionQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CushionQuote_foamId_fkey" FOREIGN KEY ("foamId") REFERENCES "Foam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CushionQuote_dacronId_fkey" FOREIGN KEY ("dacronId") REFERENCES "Dacron" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Foam_grade_key" ON "Foam"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "Dacron_name_key" ON "Dacron"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFoamPricing_customerId_foamId_key" ON "CustomerFoamPricing"("customerId", "foamId");

-- CreateIndex
CREATE UNIQUE INDEX "FoamInventory_foamId_key" ON "FoamInventory"("foamId");

-- CreateIndex
CREATE UNIQUE INDEX "DacronInventory_dacronId_key" ON "DacronInventory"("dacronId");

-- CreateIndex
CREATE UNIQUE INDEX "PartNumberTemplate_customerId_key" ON "PartNumberTemplate"("customerId");
