-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "WhsCode" TEXT NOT NULL,
    "WhsName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemWarehouseStock" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "ItemCode" TEXT NOT NULL,
    "WhsCode" TEXT NOT NULL,
    "InStock" DOUBLE PRECISION NOT NULL,
    "IsCommited" DOUBLE PRECISION,
    "OnOrder" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemWarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_WhsCode_key" ON "Warehouse"("WhsCode");

-- CreateIndex
CREATE INDEX "ItemWarehouseStock_WhsCode_idx" ON "ItemWarehouseStock"("WhsCode");

-- CreateIndex
CREATE INDEX "ItemWarehouseStock_ItemCode_idx" ON "ItemWarehouseStock"("ItemCode");

-- CreateIndex
CREATE UNIQUE INDEX "ItemWarehouseStock_itemId_warehouseId_key" ON "ItemWarehouseStock"("itemId", "warehouseId");

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
