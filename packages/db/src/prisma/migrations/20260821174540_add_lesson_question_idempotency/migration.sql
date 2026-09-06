/*
  Warnings:

  - A unique constraint covering the columns `[thread_id,request_id]` on the table `lesson_questions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `request_fingerprint` to the `lesson_questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `request_id` to the `lesson_questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "lesson_questions" ADD COLUMN     "request_fingerprint" TEXT NOT NULL,
ADD COLUMN     "request_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "lesson_questions_thread_id_request_id_key" ON "lesson_questions"("thread_id", "request_id");
