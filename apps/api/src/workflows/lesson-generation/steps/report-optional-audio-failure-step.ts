import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { logError } from "@zoonk/utils/logger";

type OptionalAudioStepName = Extract<
  LessonStepName,
  | "generateAlphabetAudio"
  | "generateReadingAudio"
  | "generateSentenceWordAudio"
  | "generateVocabularyAudio"
>;

/**
 * Reports an optional audio failure only after the owning generation step has
 * exhausted Workflow's automatic retries. Keeping logging in a step provides
 * Node.js access and prevents transient attempts from creating duplicate alerts.
 */
export async function reportOptionalAudioFailureStep({
  error,
  lessonId,
  step,
}: {
  error: string;
  lessonId: string;
  step: OptionalAudioStepName;
}): Promise<void> {
  "use step";

  logError("[Lesson Audio Generation Permanently Failed]", { error, lessonId, step });
}
