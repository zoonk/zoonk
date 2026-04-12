-- DropForeignKey
ALTER TABLE "daily_progress" DROP CONSTRAINT "daily_progress_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_organization_id_fkey";

-- DropIndex
DROP INDEX "daily_progress_organization_id_idx";

-- DropIndex
DROP INDEX "daily_progress_user_id_date_organization_id_key";

-- DropIndex
DROP INDEX "step_attempts_organization_id_idx";

-- DropIndex
DROP INDEX "step_attempts_user_id_organization_id_idx";

-- AlterTable
ALTER TABLE "daily_progress" DROP COLUMN "organization_id";

-- AlterTable
ALTER TABLE "step_attempts" DROP COLUMN "organization_id";

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_user_id_date_key" ON "daily_progress"("user_id", "date");
