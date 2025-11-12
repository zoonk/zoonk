/*
  Warnings:

  - You are about to drop the `courseSuggestions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."courseSuggestions";

-- CreateTable
CREATE TABLE "CourseSuggestion" (
    "id" SERIAL NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "prompt" CITEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseSuggestion_locale_prompt_key" ON "CourseSuggestion"("locale", "prompt");
