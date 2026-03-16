import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { emptyToNull, extractUniqueSentenceWords } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export type SavedSentenceWord = {
  word: string;
  wordId: number;
};

type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

function buildSaveOneWord(params: {
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  wordMetadata: Record<string, WordMetadataEntry>;
}) {
  const { organizationId, targetLanguage, userLanguage, wordMetadata } = params;

  return async (word: string): Promise<SavedSentenceWord> => {
    const metadata = wordMetadata[word];
    const translation = metadata?.translation ?? "";
    const romanization = emptyToNull(metadata?.romanization ?? null);

    const record = await prisma.word.upsert({
      create: {
        organizationId,
        romanization,
        targetLanguage,
        translation,
        userLanguage,
        word,
      },
      update: {
        romanization,
        translation,
      },
      where: {
        orgWord: { organizationId, targetLanguage, userLanguage, word },
      },
    });

    return { word, wordId: Number(record.id) };
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

  await streamStatus({ status: "started", step: "saveSentenceWords" });

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
    await streamStatus({ status: "completed", step: "saveSentenceWords" });
    return { savedSentenceWords: [] };
  }

  const saveOneWord = buildSaveOneWord({
    organizationId,
    targetLanguage,
    userLanguage,
    wordMetadata,
  });

  const { data: savedSentenceWords, error } = await safeAsync(() =>
    Promise.all(uniqueWords.map((word) => saveOneWord(word))),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "saveSentenceWords" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { savedSentenceWords: [] };
  }

  await streamStatus({ status: "completed", step: "saveSentenceWords" });
  return { savedSentenceWords };
}
