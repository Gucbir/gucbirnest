-- CreateTable
CREATE TABLE "OpenSalesOrder" (
    "id" SERIAL NOT NULL,
    "docEntry" INTEGER NOT NULL,
    "docNum" INTEGER,
    "cardCode" TEXT,
    "cardName" TEXT,
    "docDate" TIMESTAMP(3),
    "docDueDate" TIMESTAMP(3),
    "docTotal" DOUBLE PRECISION,
    "docTotalFc" DOUBLE PRECISION,
    "docCurrency" TEXT,
    "comments" TEXT,
    "documentStatus" TEXT,
    "cancelled" TEXT,
    "serialNo" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrder_docEntry_key" ON "OpenSalesOrder"("docEntry");

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrder_serialNo_key" ON "OpenSalesOrder"("serialNo");
