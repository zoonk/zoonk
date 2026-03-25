import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { generateTranslation } from "@zoonk/ai/tasks/activities/language/translation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

async function fetchExistingWordMetadata(params: {
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  words: string[];
}): Promise<Record<string, WordMetadataEntry>> {
  const existing = await prisma.word.findMany({
    where: {
      organizationId: params.organizationId,
      targetLanguage: params.targetLanguage,
      userLanguage: params.userLanguage,
      word: { in: params.words, mode: "insensitive" },
    },
  });

  return Object.fromEntries(
    existing
      .filter((record) => record.translation)
      .map((record) => [
        record.word.toLowerCase(),
        { romanization: record.romanization, translation: record.translation },
      ]),
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
  organizationId: number;
  savedSentences: SavedSentence[];
  targetLanguage: string;
  userLanguage: string;
}): Promise<{ isComplete: boolean; wordMetadata: Record<string, WordMetadataEntry> }> {
  const uniqueWords = extractUniqueSentenceWords(
    params.savedSentences.map((saved) => saved.sentence),
  );

  if (uniqueWords.length === 0) {
    return { isComplete: true, wordMetadata: {} };
  }

  const existingMetadata = await fetchExistingWordMetadata({
    organizationId: params.organizationId,
    targetLanguage: params.targetLanguage,
    userLanguage: params.userLanguage,
    words: uniqueWords,
  });

  const wordsNeedingTranslation = uniqueWords.filter((word) => !existingMetadata[word]);

  if (wordsNeedingTranslation.length === 0) {
    return { isComplete: true, wordMetadata: existingMetadata };
  }

  const [translationResult, romanizationResult] = await Promise.allSettled([
    generateMissingTranslations(
      wordsNeedingTranslation,
      params.userLanguage,
      params.targetLanguage,
    ),
    generateWordRomanizations(wordsNeedingTranslation, params.targetLanguage),
  ]);

  const translations = translationResult.status === "fulfilled" ? translationResult.value : {};
  const romanizations = romanizationResult.status === "fulfilled" ? romanizationResult.value : {};

  const isComplete = Object.keys(translations).length === wordsNeedingTranslation.length;

  const generatedMetadata: Record<string, WordMetadataEntry> = Object.fromEntries(
    Object.entries(translations).map(([word, translation]) => [
      word,
      { romanization: romanizations[word] ?? null, translation },
    ]),
  );

  return { isComplete, wordMetadata: { ...existingMetadata, ...generatedMetadata } };
}

export async function generateSentenceWordMetadataStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
): Promise<{ wordMetadata: Record<string, WordMetadataEntry> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { wordMetadata: {} };
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { wordMetadata: {} };
  }

  await streamStatus({ status: "started", step: "generateSentenceWordMetadata" });

  const { isComplete, wordMetadata } = await buildWordMetadata({
    organizationId: course.organization.id,
    savedSentences,
    targetLanguage: course.targetLanguage ?? "",
    userLanguage: activity.language,
  });

  if (!isComplete) {
    await streamError({ reason: "enrichmentFailed", step: "generateSentenceWordMetadata" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordMetadata };
  }

  await streamStatus({ status: "completed", step: "generateSentenceWordMetadata" });
  return { wordMetadata };
}
