/*
  Warnings:

  - Added the required column `orderNo` to the `Form` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "orderNo" INTEGER NOT NULL;
