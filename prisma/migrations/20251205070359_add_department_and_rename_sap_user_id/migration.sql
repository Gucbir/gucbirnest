/*
  Warnings:

  - You are about to drop the column `defaultSapUserId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_defaultSapUserId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultSapUserId",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "sapUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sapUserId_fkey" FOREIGN KEY ("sapUserId") REFERENCES "SapUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
