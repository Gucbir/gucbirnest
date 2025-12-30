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
CREATE UNIQUE INDEX "AkupleItemTemplate_parentItemCode_key" ON "AkupleItemTemplate"("parentItemCode");

-- CreateIndex
CREATE INDEX "AkupleItemTemplateLine_templateId_idx" ON "AkupleItemTemplateLine"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AkupleItemTemplateLine_templateId_itemCode_lineNo_key" ON "AkupleItemTemplateLine"("templateId", "itemCode", "lineNo");

-- AddForeignKey
ALTER TABLE "AkupleItemTemplateLine" ADD CONSTRAINT "AkupleItemTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AkupleItemTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
