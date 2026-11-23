-- CreateTable
CREATE TABLE "writing_admissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "extra" BOOLEAN NOT NULL,
    "item_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writing_admissions_user_id_local_date_extra_idx" ON "writing_admissions"("user_id", "local_date", "extra");

-- AddForeignKey
ALTER TABLE "writing_admissions" ADD CONSTRAINT "writing_admissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
