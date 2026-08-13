import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type ReadingLessonContent } from "../../steps/_utils/generated-lesson-content";
import { getOptionalAudioGenerationError } from "../../steps/_utils/optional-audio-generation-error";
import { generateReadingAudioStep } from "../../steps/generate-reading-audio-step";
import { generateSentenceWordAudioStep } from "../../steps/generate-sentence-word-audio-step";
import { generateVocabularyAudioStep } from "../../steps/generate-vocabulary-audio-step";
import { type LessonContext } from "../../steps/get-lesson-step";
import { reportOptionalAudioFailureStep } from "../../steps/report-optional-audio-failure-step";

type OptionalWordAudioStepName = "generateSentenceWordAudio" | "generateVocabularyAudio";

/**
 * Completes a permanently incomplete audio phase and writes one operational log
 * after the phase's automatic retries have finished.
 */
async function recoverOptionalAudioFailure({
  error,
  lessonId,
  step,
}: {
  error: unknown;
  lessonId: string;
  step: "generateReadingAudio" | OptionalWordAudioStepName;
}): Promise<void> {
  const permanentError = getOptionalAudioGenerationError(error);

  if (!permanentError) {
    throw error;
  }

  await Promise.all([
    reportOptionalAudioFailureStep({ error: permanentError, lessonId, step }),
    streamSkipStep(step),
  ]);
}

/**
 * Lets Workflow retry vocabulary audio as a normal failed step, then continues
 * the lesson only when the final failure means some optional clips are still
 * missing. Successful clips were already persisted by every attempted batch.
 */
export async function generateOptionalVocabularyAudio({
  context,
  words,
}: {
  context: LessonContext;
  words: string[];
}): Promise<{ wordAudioUrls: Record<string, string> }> {
  try {
    return await generateVocabularyAudioStep({ context, words });
  } catch (error) {
    await recoverOptionalAudioFailure({
      error,
      lessonId: context.id,
      step: "generateVocabularyAudio",
    });

    return { wordAudioUrls: {} };
  }
}

/**
 * Preserves automatic retries for sentence pronunciation while allowing the
 * reading lesson to use its persisted sentence records after the final audio
 * attempt still leaves one or more clips missing.
 */
export async function generateOptionalReadingAudio({
  context,
  sentences,
}: {
  context: LessonContext;
  sentences: ReadingLessonContent["sentences"];
}): Promise<{ sentenceAudioUrls: Record<string, string> }> {
  try {
    return await generateReadingAudioStep({ context, sentences });
  } catch (error) {
    await recoverOptionalAudioFailure({
      error,
      lessonId: context.id,
      step: "generateReadingAudio",
    });

    return { sentenceAudioUrls: {} };
  }
}

/**
 * Keeps reading-word audio retryable independently from pronunciation and
 * metadata generation, then falls back to the Word rows saved by successful
 * attempts when only optional clips remain unavailable.
 */
export async function generateOptionalSentenceWordAudio({
  context,
  words,
}: {
  context: LessonContext;
  words: string[];
}): Promise<{ wordAudioUrls: Record<string, string> }> {
  try {
    return await generateSentenceWordAudioStep({ context, words });
  } catch (error) {
    await recoverOptionalAudioFailure({
      error,
      lessonId: context.id,
      step: "generateSentenceWordAudio",
    });

    return { wordAudioUrls: {} };
  }
}
