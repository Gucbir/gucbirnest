-- CreateTable
CREATE TABLE "ProductionStructureCache" (
    "id" SERIAL NOT NULL,
    "itemCode" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dataHash" TEXT,
    "sapBomCode" TEXT,
    "sapUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStructureCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStructureCache_itemCode_key" ON "ProductionStructureCache"("itemCode");

-- CreateIndex
CREATE INDEX "ProductionStructureCache_itemCode_idx" ON "ProductionStructureCache"("itemCode");
