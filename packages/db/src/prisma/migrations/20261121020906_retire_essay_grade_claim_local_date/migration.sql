-- DropIndex
DROP INDEX "essay_grade_claims_user_id_local_date_idx";

-- AlterTable
ALTER TABLE "essay_grade_claims" ALTER COLUMN "local_date" SET DEFAULT CURRENT_DATE;
