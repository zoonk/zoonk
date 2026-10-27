/*
  Warnings:

  - You are about to drop the `content_feedback` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_feedback" DROP CONSTRAINT "content_feedback_user_id_fkey";

-- DropTable
DROP TABLE "content_feedback";

-- DropEnum
DROP TYPE "ContentFeedbackReason";

-- DropEnum
DROP TYPE "VoteValue";
