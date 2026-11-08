-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

