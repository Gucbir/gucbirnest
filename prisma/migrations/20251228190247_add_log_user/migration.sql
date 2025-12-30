-- AlterTable
ALTER TABLE "ProductionOperationUnit" ADD COLUMN     "lastActionByUserId" INTEGER;

-- AlterTable
ALTER TABLE "ProductionOperationUnitLog" ADD COLUMN     "userId" INTEGER;
