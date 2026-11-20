-- CreateTable
CREATE TABLE "study_summary_visits" (
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "visit_id" UUID NOT NULL,

    CONSTRAINT "study_summary_visits_pkey" PRIMARY KEY ("user_id","local_date")
);

-- AddForeignKey
ALTER TABLE "study_summary_visits" ADD CONSTRAINT "study_summary_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
