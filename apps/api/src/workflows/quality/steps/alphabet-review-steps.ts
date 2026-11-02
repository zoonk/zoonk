import { type FixAlphabetLessonParams } from "@zoonk/ai/tasks/language/alphabet-lesson";
import {
  type AlphabetFix,
  publishAlphabetFix,
  reviewAlphabetLesson,
  writeAlphabetFix,
} from "@zoonk/core/library/language/review-alphabet-lesson";

export async function reviewAlphabetLessonStep(
  input: Parameters<typeof reviewAlphabetLesson>[0],
): Promise<FixAlphabetLessonParams["problems"] | null> {
  "use step";

  return reviewAlphabetLesson(input);
}

export async function writeAlphabetFixStep(
  input: Parameters<typeof writeAlphabetFix>[0],
): Promise<AlphabetFix> {
  "use step";

  return writeAlphabetFix(input);
}

export async function publishAlphabetFixStep(
  input: Parameters<typeof publishAlphabetFix>[0],
): Promise<number | null> {
  "use step";

  return publishAlphabetFix(input);
}
