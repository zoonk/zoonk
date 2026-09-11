import { type Course } from "@zoonk/db";

/**
 * A title alone is ambiguous across languages: French "Pain" is bread, not
 * English pain. Keep source meaning in both the model input and prompt cache.
 */
export function getCourseEditionPrompt(
  source: Pick<Course, "title" | "language" | "description">,
): string {
  return JSON.stringify({
    description: source.description,
    instructionalLanguage: source.language,
    title: source.title,
  });
}
