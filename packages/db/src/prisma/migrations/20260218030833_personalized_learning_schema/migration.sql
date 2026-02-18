/*
  Warnings:

  - A unique constraint covering the columns `[user_id,language,slug]` on the table `courses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CourseMode" AS ENUM ('full', 'quick_lesson', 'personalized', 'exam_prep');

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "organization_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "organization_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "mode" "CourseMode" NOT NULL DEFAULT 'full',
ADD COLUMN     "user_id" INTEGER,
ALTER COLUMN "organization_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "organization_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "step_attempts" ALTER COLUMN "organization_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_learning_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "interests" JSONB,
    "preferences" JSONB,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_profiles_user_id_key" ON "user_learning_profiles"("user_id");

-- CreateIndex
CREATE INDEX "courses_user_id_idx" ON "courses"("user_id");

-- CreateIndex
CREATE INDEX "courses_user_id_mode_idx" ON "courses"("user_id", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "courses_user_id_language_slug_key" ON "courses"("user_id", "language", "slug");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_profiles" ADD CONSTRAINT "user_learning_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
