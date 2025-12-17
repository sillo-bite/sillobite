-- CreateTable
CREATE TABLE "delivery_persons" (
    "id" SERIAL NOT NULL,
    "delivery_person_id" TEXT NOT NULL,
    "canteen_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "employee_id" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "date_of_joining" TIMESTAMP(3),
    "vehicle_number" TEXT,
    "license_number" TEXT,
    "emergency_contact" TEXT,
    "emergency_contact_name" TEXT,
    "salary" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_persons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_persons_delivery_person_id_key" ON "delivery_persons"("delivery_person_id");

-- CreateIndex
CREATE INDEX "delivery_persons_canteen_id_is_active_idx" ON "delivery_persons"("canteen_id", "is_active");

-- CreateIndex
CREATE INDEX "delivery_persons_delivery_person_id_idx" ON "delivery_persons"("delivery_person_id");
