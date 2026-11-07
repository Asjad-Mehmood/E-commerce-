-- Typo-tolerant product search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "remindersSent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "details" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cartReminders" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Product_title_trgm_idx" ON "Product" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "Review_isApproved_createdAt_idx" ON "Review"("isApproved", "createdAt");


-- Backfill delivery dates (used for the return window) from the status history.
UPDATE "Order" o SET "deliveredAt" = h.at
FROM (
  SELECT "orderId", max("createdAt") AS at FROM "OrderStatusHistory"
  WHERE status = 'DELIVERED' GROUP BY "orderId"
) h
WHERE o.id = h."orderId" AND o."deliveredAt" IS NULL;
