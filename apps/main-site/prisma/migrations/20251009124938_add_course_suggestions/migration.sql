CREATE EXTENSION IF NOT EXISTS citext;

-- CreateTable
CREATE TABLE "courseSuggestions" (
    "id" SERIAL NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "prompt" CITEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courseSuggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courseSuggestions_locale_prompt_key" ON "courseSuggestions"("locale", "prompt");
