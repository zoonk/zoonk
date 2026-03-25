import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { emptyToNull, extractUniqueSentenceWords } from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export type SavedSentenceWord = {
  word: string;
  wordAudioId: bigint | null;
  wordId: number;
};

type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

function buildSaveOneWord(params: {
  existingCasing: Record<string, string>;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  wordMetadata: Record<string, WordMetadataEntry>;
}) {
  const { existingCasing, organizationId, targetLanguage, userLanguage, wordMetadata } = params;

  return async (word: string): Promise<SavedSentenceWord> => {
    const metadata = wordMetadata[word];
    const translation = metadata?.translation ?? "";
    const romanization = emptyToNull(metadata?.romanization ?? null);
    const dbWord = existingCasing[word] ?? word;

    const record = await prisma.word.upsert({
      create: {
        organizationId,
        romanization,
        targetLanguage,
        translation,
        userLanguage,
        word: dbWord,
      },
      update: {
        romanization,
        translation,
      },
      where: {
        orgWord: { organizationId, targetLanguage, userLanguage, word: dbWord },
      },
    });

    return { word, wordAudioId: record.wordAudioId, wordId: Number(record.id) };
  };
}

export async function saveSentenceWordsStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
  wordMetadata: Record<string, WordMetadataEntry>,
): Promise<{ savedSentenceWords: SavedSentenceWord[] }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { savedSentenceWords: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "saveSentenceWords" });

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { savedSentenceWords: [] };
  }

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;
  const organizationId = course.organization.id;

  const uniqueWords = extractUniqueSentenceWords(
    savedSentences.map((saved) => saved.sentence),
  ).filter((word) => wordMetadata[word]);

  if (uniqueWords.length === 0) {
    await stream.status({ status: "completed", step: "saveSentenceWords" });
    return { savedSentenceWords: [] };
  }

  const existingCasing = await fetchExistingWordCasing({
    organizationId,
    targetLanguage,
    userLanguage,
    words: uniqueWords,
  });

  const saveOneWord = buildSaveOneWord({
    existingCasing,
    organizationId,
    targetLanguage,
    userLanguage,
    wordMetadata,
  });

  const { data: savedSentenceWords, error } = await safeAsync(() =>
    Promise.all(uniqueWords.map((word) => saveOneWord(word))),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveSentenceWords" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { savedSentenceWords: [] };
  }

  await stream.status({ status: "completed", step: "saveSentenceWords" });
  return { savedSentenceWords };
}
