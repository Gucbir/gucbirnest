/*
  Warnings:

  - You are about to drop the column `sapBomCode` on the `ProductionStructureCache` table. All the data in the column will be lost.
  - You are about to drop the column `sapUpdatedAt` on the `ProductionStructureCache` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductionStructureCache" DROP COLUMN "sapBomCode",
DROP COLUMN "sapUpdatedAt";
