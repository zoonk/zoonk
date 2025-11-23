/*
  Warnings:

  - You are about to drop the `CourseSuggestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CourseSuggestion";

-- CreateTable
CREATE TABLE "courseSuggestion" (
    "id" SERIAL NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "prompt" CITEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courseSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courseSuggestion_locale_prompt_key" ON "courseSuggestion"("locale", "prompt");
