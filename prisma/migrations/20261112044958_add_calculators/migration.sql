-- CreateTable
CREATE TABLE "Calculator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "metaobjectId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Calculator_metaobjectId_key" ON "Calculator"("metaobjectId");

-- CreateIndex
CREATE INDEX "Calculator_shop_isArchived_idx" ON "Calculator"("shop", "isArchived");
