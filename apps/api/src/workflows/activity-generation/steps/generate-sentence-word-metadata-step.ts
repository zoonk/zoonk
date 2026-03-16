import { generateSentenceWordTranslation } from "@zoonk/ai/tasks/activities/language/sentence-word-translation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
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
      word: { in: params.words },
    },
  });

  const result: Record<string, WordMetadataEntry> = {};

  for (const record of existing) {
    if (record.translation) {
      result[record.word] = {
        romanization: record.romanization,
        translation: record.translation,
      };
    }
  }

  return result;
}

async function generateTranslation(
  word: string,
  userLanguage: string,
  targetLanguage: string,
): Promise<{ data: WordMetadataEntry; word: string } | null> {
  const { data: result, error } = await safeAsync(() =>
    generateSentenceWordTranslation({ targetLanguage, userLanguage, word }),
  );

  if (error || !result?.data) {
    return null;
  }

  return {
    data: {
      romanization: result.data.romanization,
      translation: result.data.translation,
    },
    word,
  };
}

async function generateMissingTranslations(
  wordsNeedingTranslation: string[],
  userLanguage: string,
  targetLanguage: string,
): Promise<Record<string, WordMetadataEntry>> {
  const results = await Promise.allSettled(
    wordsNeedingTranslation.map((word) => generateTranslation(word, userLanguage, targetLanguage)),
  );

  const generated: Record<string, WordMetadataEntry> = {};

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      generated[result.value.word] = result.value.data;
    }
  }

  return generated;
}

async function buildWordMetadata(params: {
  activityId: number;
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

  const generated = await generateMissingTranslations(
    wordsNeedingTranslation,
    params.userLanguage,
    params.targetLanguage,
  );

  const wordMetadata = { ...existingMetadata, ...generated };
  const isComplete = Object.keys(generated).length >= wordsNeedingTranslation.length;

  return { isComplete, wordMetadata };
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
    activityId: activity.id,
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
