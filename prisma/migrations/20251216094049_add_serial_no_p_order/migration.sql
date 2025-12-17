/*
  Warnings:

  - Added the required column `serialNo` to the `ProductionOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "serialNo" TEXT NOT NULL;
