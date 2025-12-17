-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT,
    "role" TEXT NOT NULL,
    "register_number" TEXT,
    "department" TEXT,
    "joining_year" INTEGER,
    "passing_out_year" INTEGER,
    "current_study_year" INTEGER,
    "is_passed" BOOLEAN DEFAULT false,
    "staff_id" TEXT,
    "is_profile_complete" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_register_number_key" ON "public"."users"("register_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_staff_id_key" ON "public"."users"("staff_id");
