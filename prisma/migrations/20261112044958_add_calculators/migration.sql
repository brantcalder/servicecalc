-- CreateTable
CREATE TABLE "Calculator" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "metaobjectId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Calculator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Calculator_metaobjectId_key" ON "Calculator"("metaobjectId");

-- CreateIndex
CREATE INDEX "Calculator_shop_isArchived_idx" ON "Calculator"("shop", "isArchived");
