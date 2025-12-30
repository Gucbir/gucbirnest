-- CreateTable
CREATE TABLE "ProductionAlternativeLog" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "bomItemCode" TEXT NOT NULL,
    "bomItemName" TEXT NOT NULL,
    "bomWhsCode" TEXT,
    "bomQty" DOUBLE PRECISION,
    "selectedItemCode" TEXT,
    "selectedItemName" TEXT,
    "selectedWhsCode" TEXT,
    "selectedQty" DOUBLE PRECISION,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "sapIssueDocEntry" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionAlternativeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_operationId_idx" ON "ProductionAlternativeLog"("operationId");

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_unitId_idx" ON "ProductionAlternativeLog"("unitId");

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_itemId_idx" ON "ProductionAlternativeLog"("itemId");

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductionOrderUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductionOperationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
