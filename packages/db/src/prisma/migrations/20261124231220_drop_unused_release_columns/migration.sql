/*
  Warnings:

  - You are about to drop the column `local_date` on the `essay_grade_claims` table. All the data in the column will be lost.
  - You are about to drop the column `answered_at` on the `learner_sources` table. All the data in the column will be lost.
  - You are about to drop the column `goal_id` on the `learner_sources` table. All the data in the column will be lost.

*/
-- The trigger copied the previous release's writes to these columns into goal_sources, and it
-- depends on "goal_id" and "answered_at".
DROP TRIGGER "learner_source_goal_to_goal_sources" ON "learner_sources";
DROP FUNCTION "copy_learner_source_goal"();

-- AlterTable
ALTER TABLE "essay_grade_claims" DROP COLUMN "local_date";

-- AlterTable
ALTER TABLE "learner_sources" DROP COLUMN "answered_at",
DROP COLUMN "goal_id";
