-- AlterTable
ALTER TABLE "ProductionOperationItem" ADD COLUMN     "isAlternative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sapIssueDocEntry" INTEGER,
ADD COLUMN     "selectedItemCode" TEXT,
ADD COLUMN     "selectedItemName" TEXT,
ADD COLUMN     "selectedQuantity" DOUBLE PRECISION,
ADD COLUMN     "selectedWarehouseCode" TEXT;
