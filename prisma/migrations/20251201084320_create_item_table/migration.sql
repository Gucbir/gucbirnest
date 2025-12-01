-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "ItemCode" TEXT NOT NULL,
    "ItemName" TEXT NOT NULL,
    "ForeignName" TEXT,
    "ItemType" TEXT NOT NULL,
    "InventoryItem" BOOLEAN NOT NULL,
    "SalesItem" BOOLEAN NOT NULL,
    "PurchaseItem" BOOLEAN NOT NULL,
    "InventoryUoM" TEXT,
    "SalesUoM" TEXT,
    "PurchaseUoM" TEXT,
    "ItemsGroupCode" INTEGER,
    "MinInventory" DOUBLE PRECISION,
    "MaxInventory" DOUBLE PRECISION,
    "Valid" BOOLEAN NOT NULL,
    "Frozen" BOOLEAN NOT NULL,
    "AssetItem" BOOLEAN NOT NULL,
    "AvgPrice" DOUBLE PRECISION,
    "LastPurPrc" DOUBLE PRECISION,
    "LastPurCur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_ItemCode_key" ON "Item"("ItemCode");
