-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "user_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing user counts
UPDATE courses SET user_count = (SELECT COUNT(*) FROM course_users WHERE course_id = courses.id);
