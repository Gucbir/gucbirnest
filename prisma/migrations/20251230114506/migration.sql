-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "vkn" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "department" TEXT,
    "sapUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SapUser" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SapUser_pkey" PRIMARY KEY ("id")
);

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
    "QuantityOnStock" DOUBLE PRECISION,
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

-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" SERIAL NOT NULL,
    "sapDocEntry" INTEGER,
    "sapDocNum" INTEGER,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "stageCode" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProductionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperationItem" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uomName" TEXT,
    "warehouseCode" TEXT,
    "issueMethod" TEXT,
    "lineNo" INTEGER,
    "selectedItemCode" TEXT,
    "selectedItemName" TEXT,
    "selectedWarehouseCode" TEXT,
    "selectedQuantity" DOUBLE PRECISION,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "sapIssueDocEntry" INTEGER,

    CONSTRAINT "ProductionOperationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "ProductionStructureCache" (
    "id" SERIAL NOT NULL,
    "itemCode" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dataHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStructureCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialShortageRun" (
    "id" SERIAL NOT NULL,
    "payload" JSONB NOT NULL,
    "shortages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialShortageRun_pkey" PRIMARY KEY ("id")
);

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
    "parentItemName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderUnit" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "serialNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrderUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperationUnit" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastActionByUserId" INTEGER,
    "pausedAt" TIMESTAMP(3),
    "pausedTotalSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOperationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperationUnitLog" (
    "id" SERIAL NOT NULL,
    "operationUnitId" INTEGER NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOperationUnitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperationUnitItemSelection" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "selectedItemCode" TEXT,
    "selectedItemName" TEXT,
    "selectedWarehouseCode" TEXT,
    "selectedQuantity" DOUBLE PRECISION,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOperationUnitItemSelection_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "AkupleItemTemplate" (
    "id" SERIAL NOT NULL,
    "parentItemCode" TEXT NOT NULL,
    "parentItemName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AkupleItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AkupleItemTemplateLine" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uomName" TEXT,
    "warehouseCode" TEXT,
    "issueMethod" TEXT,
    "lineNo" INTEGER,

    CONSTRAINT "AkupleItemTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_vkn_key" ON "User"("vkn");

-- CreateIndex
CREATE UNIQUE INDEX "SapUser_code_key" ON "SapUser"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_ItemCode_key" ON "Item"("ItemCode");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_WhsCode_key" ON "Warehouse"("WhsCode");

-- CreateIndex
CREATE INDEX "ItemWarehouseStock_WhsCode_idx" ON "ItemWarehouseStock"("WhsCode");

-- CreateIndex
CREATE INDEX "ItemWarehouseStock_ItemCode_idx" ON "ItemWarehouseStock"("ItemCode");

-- CreateIndex
CREATE UNIQUE INDEX "ItemWarehouseStock_itemId_warehouseId_key" ON "ItemWarehouseStock"("itemId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_name_key" ON "Setting"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Form_name_key" ON "Form"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrder_docEntry_key" ON "OpenSalesOrder"("docEntry");

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrder_serialNo_key" ON "OpenSalesOrder"("serialNo");

-- CreateIndex
CREATE INDEX "OpenSalesOrderLine_docEntry_idx" ON "OpenSalesOrderLine"("docEntry");

-- CreateIndex
CREATE INDEX "OpenSalesOrderLine_itemCode_idx" ON "OpenSalesOrderLine"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "OpenSalesOrderLine_orderId_lineNum_key" ON "OpenSalesOrderLine"("orderId", "lineNum");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStructureCache_itemCode_key" ON "ProductionStructureCache"("itemCode");

-- CreateIndex
CREATE INDEX "ProductionStructureCache_itemCode_idx" ON "ProductionStructureCache"("itemCode");

-- CreateIndex
CREATE INDEX "PurchaseRequest_materialRunId_idx" ON "PurchaseRequest"("materialRunId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_itemCode_idx" ON "PurchaseRequestItem"("itemCode");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_requestId_idx" ON "PurchaseRequestItem"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderUnit_serialNo_key" ON "ProductionOrderUnit"("serialNo");

-- CreateIndex
CREATE INDEX "ProductionOrderUnit_orderId_idx" ON "ProductionOrderUnit"("orderId");

-- CreateIndex
CREATE INDEX "ProductionOperationUnit_operationId_idx" ON "ProductionOperationUnit"("operationId");

-- CreateIndex
CREATE INDEX "ProductionOperationUnit_unitId_idx" ON "ProductionOperationUnit"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOperationUnit_operationId_unitId_key" ON "ProductionOperationUnit"("operationId", "unitId");

-- CreateIndex
CREATE INDEX "ProductionOperationUnitLog_operationUnitId_idx" ON "ProductionOperationUnitLog"("operationUnitId");

-- CreateIndex
CREATE INDEX "ProductionOperationUnitItemSelection_unitId_idx" ON "ProductionOperationUnitItemSelection"("unitId");

-- CreateIndex
CREATE INDEX "ProductionOperationUnitItemSelection_itemId_idx" ON "ProductionOperationUnitItemSelection"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOperationUnitItemSelection_operationId_unitId_ite_key" ON "ProductionOperationUnitItemSelection"("operationId", "unitId", "itemId");

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_operationId_idx" ON "ProductionAlternativeLog"("operationId");

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_unitId_idx" ON "ProductionAlternativeLog"("unitId");

-- CreateIndex
CREATE INDEX "ProductionAlternativeLog_itemId_idx" ON "ProductionAlternativeLog"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AkupleItemTemplate_parentItemCode_key" ON "AkupleItemTemplate"("parentItemCode");

-- CreateIndex
CREATE INDEX "AkupleItemTemplateLine_templateId_idx" ON "AkupleItemTemplateLine"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AkupleItemTemplateLine_templateId_itemCode_lineNo_key" ON "AkupleItemTemplateLine"("templateId", "itemCode", "lineNo");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sapUserId_fkey" FOREIGN KEY ("sapUserId") REFERENCES "SapUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "ProductionOperation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationItem" ADD CONSTRAINT "ProductionOperationItem_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSalesOrderLine" ADD CONSTRAINT "OpenSalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OpenSalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderUnit" ADD CONSTRAINT "ProductionOrderUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnit" ADD CONSTRAINT "ProductionOperationUnit_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnit" ADD CONSTRAINT "ProductionOperationUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductionOrderUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnit" ADD CONSTRAINT "ProductionOperationUnit_lastActionByUserId_fkey" FOREIGN KEY ("lastActionByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnitLog" ADD CONSTRAINT "ProductionOperationUnitLog_operationUnitId_fkey" FOREIGN KEY ("operationUnitId") REFERENCES "ProductionOperationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnitItemSelection" ADD CONSTRAINT "ProductionOperationUnitItemSelection_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnitItemSelection" ADD CONSTRAINT "ProductionOperationUnitItemSelection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductionOrderUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperationUnitItemSelection" ADD CONSTRAINT "ProductionOperationUnitItemSelection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductionOperationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductionOrderUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionAlternativeLog" ADD CONSTRAINT "ProductionAlternativeLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductionOperationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AkupleItemTemplateLine" ADD CONSTRAINT "AkupleItemTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AkupleItemTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
