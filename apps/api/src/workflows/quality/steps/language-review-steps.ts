import {
  type LanguageLessonFix,
  type LessonProblem,
  publishLanguageLessonFix,
  reviewLanguageLesson,
  reviewLanguageLessonFix,
  writeLanguageLessonFix,
} from "@zoonk/core/library/language/review-lesson";

export async function reviewLanguageLessonStep(
  input: Parameters<typeof reviewLanguageLesson>[0],
): Promise<LessonProblem[] | null> {
  "use step";

  return reviewLanguageLesson(input);
}

export async function writeLanguageLessonFixStep(
  input: Parameters<typeof writeLanguageLessonFix>[0],
): Promise<LanguageLessonFix> {
  "use step";

  return writeLanguageLessonFix(input);
}

export async function reviewLanguageLessonFixStep(
  input: Parameters<typeof reviewLanguageLessonFix>[0],
): Promise<LessonProblem[] | null> {
  "use step";

  return reviewLanguageLessonFix(input);
}

export async function publishLanguageLessonFixStep(
  input: Parameters<typeof publishLanguageLessonFix>[0],
): Promise<number | null> {
  "use step";

  return publishLanguageLessonFix(input);
}
