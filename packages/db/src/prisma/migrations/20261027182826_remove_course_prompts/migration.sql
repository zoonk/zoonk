/*
  Warnings:

  - You are about to drop the `course_prompts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "course_prompts" DROP CONSTRAINT "course_prompts_course_id_fkey";

-- DropTable
DROP TABLE "course_prompts";

-- DropEnum
DROP TYPE "CoursePromptIntent";
