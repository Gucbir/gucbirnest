-- CreateTable
CREATE TABLE "OpenSalesOrderLine" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "lineNum" INTEGER NOT NULL,
    "docEntry" INTEGER NOT NULL,
    "itemCode" TEXT,
    "itemDescription" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT,
    "rate" DOUBLE PRECISION,
    "warehouseCode" TEXT,
    "lineTotal" DOUBLE PRECISION,
    "rowTotalFC" DOUBLE PRECISION,
    "rowTotalSC" DOUBLE PRECISION,
    "lineStatus" TEXT,
    "shipDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenSalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpenSalesOrderLine_docEntry_idx" ON "OpenSalesOrderLine"("docEntry");

-- CreateIndex
CREATE INDEX "OpenSalesOrderLine_itemCode_idx" ON "OpenSalesOrderLine"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrderLine_orderId_lineNum_key" ON "OpenSalesOrderLine"("orderId", "lineNum");

-- AddForeignKey
ALTER TABLE "OpenSalesOrderLine" ADD CONSTRAINT "OpenSalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OpenSalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
