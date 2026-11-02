import {
  type WriteAlphabetLessonResult,
  failAlphabetLesson,
  publishAlphabetLesson,
  voiceAlphabetClip,
  writeAlphabetLesson,
} from "@zoonk/core/library/language/write-alphabet-lesson";

export async function writeAlphabetLessonStep(
  input: Parameters<typeof writeAlphabetLesson>[0],
): Promise<WriteAlphabetLessonResult> {
  "use step";

  return writeAlphabetLesson(input);
}

/** One clip per step, so a failed clip retries alone. */
export async function voiceAlphabetClipStep(
  input: Parameters<typeof voiceAlphabetClip>[0],
): Promise<string> {
  "use step";

  return voiceAlphabetClip(input);
}

export async function publishAlphabetLessonStep(
  input: Parameters<typeof publishAlphabetLesson>[0],
): Promise<boolean> {
  "use step";

  return publishAlphabetLesson(input);
}

export async function failAlphabetLessonStep(
  input: Parameters<typeof failAlphabetLesson>[0],
): Promise<void> {
  "use step";

  await failAlphabetLesson(input);
}
