/*
  Warnings:

  - You are about to drop the column `ItemsGroupCode` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `ItemsGroupName` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "ItemsGroupCode",
DROP COLUMN "ItemsGroupName",
ADD COLUMN     "itemGroupId" INTEGER;

-- CreateTable
CREATE TABLE "ItemGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemGroup_code_key" ON "ItemGroup"("code");

-- CreateIndex
CREATE INDEX "ItemGroup_name_idx" ON "ItemGroup"("name");

-- CreateIndex
CREATE INDEX "Item_itemGroupId_idx" ON "Item"("itemGroupId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "ItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
