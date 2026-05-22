import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type AlphabetLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Returns each unique text snippet that can be safely spoken for symbol cards.
 *
 * The generated symbol itself is often the right audio target, but keeping this
 * field explicit lets scripts use a simple syllable when bare symbols are not
 * useful for TTS.
 */
function getUniqueAudioTexts(symbols: AlphabetLessonContent["symbols"]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.audioText).filter(Boolean))];
}

/**
 * Generates optional pronunciation audio for alphabet cards.
 *
 * Audio lives inside the alphabet step content instead of the global Word table
 * because these symbols are not vocabulary resources.
 */
export async function generateAlphabetAudioStep({
  context,
  symbols,
}: {
  context: LessonContext;
  symbols: AlphabetLessonContent["symbols"];
}): Promise<{ audioUrls: Record<string, string> }> {
  "use step";

  const audioTexts = getUniqueAudioTexts(symbols);

  if (audioTexts.length === 0) {
    return { audioUrls: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateAlphabetAudio" });

  const course = context.chapter.course;
  const organization = course.organization;
  const targetLanguage = course.targetLanguage;

  if (!targetLanguage || !isTTSSupportedLanguage(targetLanguage) || !organization) {
    await stream.status({ status: "completed", step: "generateAlphabetAudio" });
    return { audioUrls: {} };
  }

  const results = await Promise.all(
    audioTexts.map((text) =>
      generateAudioForText({
        language: targetLanguage,
        orgSlug: organization.slug,
        text,
        usage: "alphabetSymbol",
      }),
    ),
  );

  await stream.status({ status: "completed", step: "generateAlphabetAudio" });

  return { audioUrls: Object.fromEntries(results.map((result) => [result.text, result.audioUrl])) };
}
