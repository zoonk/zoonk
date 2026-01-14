/*
  Warnings:

  - Added the required column `day_of_week` to the `daily_progress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "daily_progress" ADD COLUMN     "day_of_week" SMALLINT NOT NULL;

-- CreateIndex
CREATE INDEX "daily_progress_user_id_day_of_week_idx" ON "daily_progress"("user_id", "day_of_week");
