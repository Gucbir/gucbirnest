-- CreateTable
CREATE TABLE "MaterialShortageRun" (
    "id" SERIAL NOT NULL,
    "payload" JSONB NOT NULL,
    "shortages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialShortageRun_pkey" PRIMARY KEY ("id")
);
