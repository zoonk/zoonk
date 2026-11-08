-- AlterTable
ALTER TABLE "study_reminders" ADD COLUMN     "push_session_id" UUID;

-- AddForeignKey
ALTER TABLE "study_reminders" ADD CONSTRAINT "study_reminders_push_session_id_fkey" FOREIGN KEY ("push_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
