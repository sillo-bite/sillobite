-- AlterTable
ALTER TABLE "delivery_persons" ADD COLUMN "is_available" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "delivery_persons" ADD COLUMN "total_order_delivered" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "delivery_persons_canteen_id_is_available_idx" ON "delivery_persons"("canteen_id", "is_available");

