import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type AlphabetLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";
import { reportOptionalAudioFailureStep } from "./report-optional-audio-failure-step";

type AlphabetAudioStatus = "started" | "completed";

/**
 * Returns each unique text snippet that can be safely spoken for symbol cards.
 * The generated symbol itself is often the right audio target, but the explicit
 * audio text lets a script use a simple syllable when a bare symbol is unclear.
 */
function getUniqueAudioTexts(symbols: AlphabetLessonContent["symbols"]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.audioText).filter(Boolean))];
}

/**
 * Gives every alphabet clip its own durable retry boundary. Unlike Word and
 * Sentence audio, alphabet clips have no database row before the lesson is
 * saved, so successful step outputs are what prevent duplicate TTS uploads
 * while Workflow retries only the symbols that failed.
 */
async function generateAlphabetAudioForTextStep({
  language,
  orgSlug,
  text,
}: {
  language: string;
  orgSlug: string;
  text: string;
}): Promise<{ audioUrl: string; text: string }> {
  "use step";

  const result = await generateAudioForText({ language, orgSlug, text, usage: "alphabetSymbol" });

  if (!result) {
    throw new Error(`alphabetAudioGenerationIncomplete:${text}`);
  }

  return result;
}

/**
 * Keeps the existing lesson-generation progress event around the individual
 * per-symbol steps, whose internal names should not become client-facing phase
 * names.
 */
async function streamAlphabetAudioStatusStep({
  status,
}: {
  status: AlphabetAudioStatus;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status, step: "generateAlphabetAudio" });
}

/**
 * Emits the public completion phase and, when necessary, one permanent-failure
 * log after every failed symbol step has exhausted its own retries.
 */
async function completeAlphabetAudioGeneration({
  errors,
  lessonId,
}: {
  errors: string[];
  lessonId: string;
}): Promise<void> {
  if (errors.length === 0) {
    await streamAlphabetAudioStatusStep({ status: "completed" });
    return;
  }

  await Promise.all([
    reportOptionalAudioFailureStep({
      error: errors.join(", "),
      lessonId,
      step: "generateAlphabetAudio",
    }),
    streamAlphabetAudioStatusStep({ status: "completed" }),
  ]);
}

/**
 * Converts a rejected symbol step into the serialized error text needed by the
 * permanent-failure reporter while fulfilled symbol results stay out of logs.
 */
function getRejectedAlphabetAudioError(
  result: PromiseSettledResult<{ audioUrl: string; text: string }>,
): string[] {
  if (result.status === "fulfilled") {
    return [];
  }

  return [result.reason instanceof Error ? result.reason.message : String(result.reason)];
}

/**
 * Generates all alphabet pronunciations concurrently and treats audio as an
 * optional enrichment after each failed symbol has exhausted its own Workflow
 * retries. Successful symbol-step outputs remain durable and are never rerun.
 */
export async function generateAlphabetAudio({
  context,
  symbols,
}: {
  context: LessonContext;
  symbols: AlphabetLessonContent["symbols"];
}): Promise<{ audioUrls: Record<string, string> }> {
  const audioTexts = getUniqueAudioTexts(symbols);

  if (audioTexts.length === 0) {
    return { audioUrls: {} };
  }

  await streamAlphabetAudioStatusStep({ status: "started" });

  const course = context.chapter.course;
  const organization = course.organization;
  const targetLanguage = course.targetLanguage;

  if (!targetLanguage || !isTTSSupportedLanguage(targetLanguage) || !organization) {
    await streamAlphabetAudioStatusStep({ status: "completed" });
    return { audioUrls: {} };
  }

  const results = await Promise.allSettled(
    audioTexts.map((text) =>
      generateAlphabetAudioForTextStep({
        language: targetLanguage,
        orgSlug: organization.slug,
        text,
      }),
    ),
  );

  const permanentErrors = results.flatMap((result) => getRejectedAlphabetAudioError(result));

  await completeAlphabetAudioGeneration({ errors: permanentErrors, lessonId: context.id });

  return {
    audioUrls: Object.fromEntries(
      results.flatMap((result) =>
        result.status === "fulfilled" ? [[result.value.text, result.value.audioUrl]] : [],
      ),
    ),
  };
}
