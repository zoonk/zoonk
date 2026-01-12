/*
  Warnings:

  - You are about to drop the column `prompt` on the `course_suggestions` table. All the data in the column will be lost.
  - You are about to drop the column `suggestions` on the `course_suggestions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[language,slug]` on the table `course_suggestions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `course_suggestions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `course_suggestions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `course_suggestions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "course_suggestions_language_prompt_key";

-- AlterTable
ALTER TABLE "course_suggestions" DROP COLUMN "prompt",
DROP COLUMN "suggestions",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "search_prompts" (
    "id" SERIAL NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "prompt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_prompt_suggestions" (
    "id" SERIAL NOT NULL,
    "search_prompt_id" INTEGER NOT NULL,
    "course_suggestion_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_prompt_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_prompts_language_prompt_key" ON "search_prompts"("language", "prompt");

-- CreateIndex
CREATE INDEX "search_prompt_suggestions_search_prompt_id_idx" ON "search_prompt_suggestions"("search_prompt_id");

-- CreateIndex
CREATE INDEX "search_prompt_suggestions_course_suggestion_id_idx" ON "search_prompt_suggestions"("course_suggestion_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_prompt_suggestions_search_prompt_id_course_suggestio_key" ON "search_prompt_suggestions"("search_prompt_id", "course_suggestion_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_suggestions_language_slug_key" ON "course_suggestions"("language", "slug");

-- AddForeignKey
ALTER TABLE "search_prompt_suggestions" ADD CONSTRAINT "search_prompt_suggestions_search_prompt_id_fkey" FOREIGN KEY ("search_prompt_id") REFERENCES "search_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_prompt_suggestions" ADD CONSTRAINT "search_prompt_suggestions_course_suggestion_id_fkey" FOREIGN KEY ("course_suggestion_id") REFERENCES "course_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
