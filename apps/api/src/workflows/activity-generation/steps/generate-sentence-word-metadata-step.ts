import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { generateTranslation } from "@zoonk/ai/tasks/activities/language/translation";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

/**
 * Fetches existing romanization from `Word` records (case-insensitive).
 * Only returns romanization — NOT translations. Translations are always
 * generated fresh per lesson because the same word can mean different
 * things in different sentence contexts (e.g. "banco" = "bank" in a
 * finance lesson vs "bench" in a furniture lesson). Reusing another
 * lesson's translation would silently pick the wrong meaning for
 * polysemous words.
 */
async function fetchExistingWordRomanizations(params: {
  organizationId: string;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string | null>> {
  const existing = await prisma.word.findMany({
    where: {
      organizationId: params.organizationId,
      targetLanguage: params.targetLanguage,
      word: { in: params.words, mode: "insensitive" },
    },
  });

  return Object.fromEntries(
    existing.map((record) => [record.word.toLowerCase(), record.romanization]),
  );
}

async function translateWord(
  word: string,
  userLanguage: string,
  targetLanguage: string,
): Promise<{ translation: string; word: string } | null> {
  const { data: result, error } = await safeAsync(() =>
    generateTranslation({ targetLanguage, userLanguage, word }),
  );

  if (error || !result?.data) {
    return null;
  }

  return { translation: result.data.translation, word };
}

async function generateMissingTranslations(
  wordsNeedingTranslation: string[],
  userLanguage: string,
  targetLanguage: string,
): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    wordsNeedingTranslation.map((word) => translateWord(word, userLanguage, targetLanguage)),
  );

  return Object.fromEntries(
    results.flatMap((result) => {
      if (result.status !== "fulfilled" || !result.value) {
        return [];
      }

      return [[result.value.word, result.value.translation]];
    }),
  );
}

/**
 * Generates romanized (Latin-script) representations for a batch of words
 * using the existing romanization AI task. Returns early for Roman-script
 * languages (e.g., Spanish, German) since they don't need romanization.
 */
async function generateWordRomanizations(
  words: string[],
  targetLanguage: string,
): Promise<Record<string, string>> {
  if (!needsRomanization(targetLanguage)) {
    return {};
  }

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts: words }),
  );

  if (error || !result?.data) {
    return {};
  }

  return Object.fromEntries(
    words
      .map((word, index) => [word, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

/**
 * Merges translations and romanizations into a single metadata map.
 * Romanizations are only generated for non-Roman script languages.
 */
async function buildWordMetadata(params: {
  organizationId: string;
  sentences: ReadingSentence[];
  targetLanguage: string;
  targetWords: string[];
  userLanguage: string;
}): Promise<{ isComplete: boolean; wordMetadata: Record<string, WordMetadataEntry> }> {
  const canonicalWords = extractUniqueSentenceWords(
    params.sentences.map((entry) => entry.sentence),
  );
  const uniqueWords = params.targetWords;

  if (uniqueWords.length === 0) {
    return { isComplete: true, wordMetadata: {} };
  }

  // Fetch existing romanizations from the DB (meaning-independent).
  // Translations are always generated fresh — each lesson needs its own
  // because the same word can mean different things in different contexts.
  const existingRomanizations = await fetchExistingWordRomanizations({
    organizationId: params.organizationId,
    targetLanguage: params.targetLanguage,
    words: uniqueWords,
  });

  const [translationResult, romanizationResult] = await Promise.allSettled([
    generateMissingTranslations(canonicalWords, params.userLanguage, params.targetLanguage),
    generateWordRomanizations(
      uniqueWords.filter((word) => !existingRomanizations[word.toLowerCase()]),
      params.targetLanguage,
    ),
  ]);

  const translations = translationResult.status === "fulfilled" ? translationResult.value : {};
  const newRomanizations =
    romanizationResult.status === "fulfilled" ? romanizationResult.value : {};

  const isComplete = Object.keys(translations).length === canonicalWords.length;

  const wordMetadata: Record<string, WordMetadataEntry> = Object.fromEntries(
    uniqueWords.map((word) => [
      word,
      {
        romanization: existingRomanizations[word.toLowerCase()] ?? newRomanizations[word] ?? null,
        translation: translations[word] ?? "",
      },
    ]),
  );

  return { isComplete, wordMetadata };
}

export async function generateSentenceWordMetadataStep(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
  targetWords: string[],
): Promise<{ wordMetadata: Record<string, WordMetadataEntry> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return { wordMetadata: {} };
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { wordMetadata: {} };
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateSentenceWordMetadata" });

  const { isComplete, wordMetadata } = await buildWordMetadata({
    organizationId: course.organization.id,
    sentences,
    targetLanguage: course.targetLanguage ?? "",
    targetWords,
    userLanguage: activity.language,
  });

  if (!isComplete) {
    await stream.error({
      reason: "translationGenerationFailed",
      step: "generateSentenceWordMetadata",
    });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordMetadata };
  }

  await stream.status({ status: "completed", step: "generateSentenceWordMetadata" });
  return { wordMetadata };
}
