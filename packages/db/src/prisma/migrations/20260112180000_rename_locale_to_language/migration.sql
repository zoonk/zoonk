-- CourseSuggestion: rename column and index
ALTER TABLE "course_suggestions" RENAME COLUMN "locale" TO "language";
DROP INDEX "course_suggestions_locale_prompt_key";
CREATE UNIQUE INDEX "course_suggestions_language_prompt_key" ON "course_suggestions"("language", "prompt");

-- CourseAlternativeTitle: rename column and index
ALTER TABLE "course_alternative_titles" RENAME COLUMN "locale" TO "language";
DROP INDEX "course_alternative_titles_locale_slug_key";
CREATE UNIQUE INDEX "course_alternative_titles_language_slug_key" ON "course_alternative_titles"("language", "slug");
