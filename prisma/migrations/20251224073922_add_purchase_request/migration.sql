-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MATERIAL_SHORTAGE',
    "materialRunId" INTEGER,
    "docEntry" INTEGER,
    "sapDocNum" INTEGER,
    "parentItemCode" TEXT,
    "requestedQty" DOUBLE PRECISION,
    "whsCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT,
    "whsCode" TEXT,
    "required" DOUBLE PRECISION NOT NULL,
    "inStock" DOUBLE PRECISION NOT NULL,
    "missing" DOUBLE PRECISION NOT NULL,
    "purchaseQty" DOUBLE PRECISION NOT NULL,
    "parentItemCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequest_materialRunId_idx" ON "PurchaseRequest"("materialRunId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_itemCode_idx" ON "PurchaseRequestItem"("itemCode");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_requestId_idx" ON "PurchaseRequestItem"("requestId");

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
