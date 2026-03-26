import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  deduplicateNormalizedTexts,
  emptyToNull,
  extractUniqueSentenceWords,
  normalizePunctuation,
  normalizeString,
} from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

/**
 * Persists all reading data in a single step:
 * - Upserts Sentence records (sets audioUrl, romanization)
 * - Upserts SentenceTranslation records
 * - Upserts Word records for sentence words (sets audioUrl)
 * - Upserts WordTranslation records for sentence words (sets pronunciation, alternativeTranslations)
 * - Creates Step records (kind: "reading")
 * - Marks the reading activity as completed
 *
 * This is the single write point for the reading workflow. All generate
 * steps produce data without DB writes; this step persists everything at once.
 */
export async function saveReadingActivityStep(params: {
  activities: LessonActivity[];
  alternatives: Record<string, string[]>;
  pronunciations: Record<string, string>;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  sentences: ReadingSentence[];
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const {
    activities,
    alternatives,
    pronunciations,
    sentenceAudioUrls,
    sentenceRomanizations,
    sentences,
    wordAudioUrls,
    wordMetadata,
    workflowRunId,
  } = params;

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return;
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ entityId: activity.id, status: "started", step: "saveReadingActivity" });

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;
  const organizationId = course.organization.id;

  const { error: sentenceError } = await safeAsync(() =>
    Promise.all(
      sentences.map((readingSentence, position) =>
        saveOneSentence({
          activityId: activity.id,
          lessonId: activity.lessonId,
          organizationId,
          position,
          readingSentence,
          sentenceAudioUrls,
          sentenceRomanizations,
          targetLanguage,
          userLanguage,
        }),
      ),
    ),
  );

  if (sentenceError) {
    await stream.error({ reason: "dbSaveFailed", step: "saveReadingActivity" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const uniqueWords = extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)).filter(
    (word) => wordMetadata[word],
  );

  if (uniqueWords.length > 0) {
    const existingCasing = await fetchExistingWordCasing({
      organizationId,
      targetLanguage,
      words: uniqueWords,
    });

    const { error: wordError } = await safeAsync(() =>
      Promise.all(
        uniqueWords.map((word) =>
          saveOneSentenceWord({
            alternatives,
            existingCasing,
            organizationId,
            pronunciations,
            targetLanguage,
            userLanguage,
            word,
            wordAudioUrls,
            wordMetadata,
          }),
        ),
      ),
    );

    if (wordError) {
      await stream.error({ reason: "dbSaveFailed", step: "saveReadingActivity" });
      await handleActivityFailureStep({ activityId: activity.id });
      return;
    }
  }

  await markActivityAsCompleted(activity.id, workflowRunId);

  await stream.status({ entityId: activity.id, status: "completed", step: "saveReadingActivity" });
}

/**
 * Save one clean copy of each alternative so the database does not store duplicates
 * that only differ by formatting.
 * Example: keep "Bonjour!" once instead of saving both "Bonjour!" and " Bonjour ! ".
 */
function normalizeAlternativeTexts(primaryText: string, altTexts: string[]): string[] {
  const primaryKey = normalizeString(normalizePunctuation(primaryText).trim());

  return deduplicateNormalizedTexts(altTexts).filter(
    (text) => normalizeString(text) !== primaryKey,
  );
}

/**
 * Upserts a Sentence record with its translation and creates the reading Step.
 */
async function saveOneSentence(params: {
  activityId: number;
  lessonId: number;
  organizationId: number;
  position: number;
  readingSentence: ReadingSentence;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  targetLanguage: string;
  userLanguage: string;
}): Promise<void> {
  const {
    activityId,
    lessonId,
    organizationId,
    position,
    readingSentence,
    sentenceAudioUrls,
    sentenceRomanizations,
    targetLanguage,
    userLanguage,
  } = params;

  const sentence = normalizePunctuation(readingSentence.sentence);
  const alternativeSentences = normalizeAlternativeTexts(
    sentence,
    readingSentence.alternativeSentences,
  );
  const translation = normalizePunctuation(readingSentence.translation);
  const alternativeTranslations = normalizeAlternativeTexts(
    translation,
    readingSentence.alternativeTranslations,
  );

  const audioUrl = sentenceAudioUrls[readingSentence.sentence] ?? null;
  const romanization = sentenceRomanizations[readingSentence.sentence] ?? null;

  const record = await prisma.sentence.upsert({
    create: {
      alternativeSentences,
      audioUrl,
      organizationId,
      romanization,
      sentence,
      targetLanguage,
    },
    update: {
      alternativeSentences,
      ...(audioUrl ? { audioUrl } : {}),
      ...(romanization ? { romanization } : {}),
    },
    where: {
      orgSentence: {
        organizationId,
        sentence,
        targetLanguage,
      },
    },
  });

  const sentenceId = record.id;

  await prisma.sentenceTranslation.upsert({
    create: {
      alternativeTranslations,
      explanation: emptyToNull(readingSentence.explanation),
      sentenceId,
      translation,
      userLanguage,
    },
    update: {
      alternativeTranslations,
      explanation: emptyToNull(readingSentence.explanation),
      translation,
    },
    where: {
      sentenceTranslation: { sentenceId, userLanguage },
    },
  });

  await prisma.lessonSentence.upsert({
    create: { lessonId, sentenceId },
    update: {},
    where: { lessonSentence: { lessonId, sentenceId } },
  });

  await prisma.step.create({
    data: {
      activityId,
      content: assertStepContent("reading", {}),
      isPublished: true,
      kind: "reading",
      position,
      sentenceId,
    },
  });
}

/**
 * Upserts a Word record for a word extracted from a reading sentence,
 * with its translation, romanization, audio, pronunciation, and alternatives.
 */
async function saveOneSentenceWord(params: {
  alternatives: Record<string, string[]>;
  existingCasing: Record<string, string>;
  organizationId: number;
  pronunciations: Record<string, string>;
  targetLanguage: string;
  userLanguage: string;
  word: string;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
}): Promise<void> {
  const {
    alternatives,
    existingCasing,
    organizationId,
    pronunciations,
    targetLanguage,
    userLanguage,
    word,
    wordAudioUrls,
    wordMetadata,
  } = params;

  const metadata = wordMetadata[word];
  const translation = metadata?.translation ?? "";
  const romanization = emptyToNull(metadata?.romanization ?? null);
  const dbWord = existingCasing[word] ?? word;
  const audioUrl = wordAudioUrls[word] ?? null;
  const pronunciation = pronunciations[word] ?? null;
  const alternativeTranslations = alternatives[word] ?? [];

  const record = await prisma.word.upsert({
    create: {
      audioUrl,
      organizationId,
      romanization,
      targetLanguage,
      word: dbWord,
    },
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      romanization,
    },
    where: {
      orgWord: { organizationId, targetLanguage, word: dbWord },
    },
  });

  await prisma.wordTranslation.upsert({
    create: {
      alternativeTranslations,
      pronunciation,
      translation,
      userLanguage,
      wordId: record.id,
    },
    update: {
      ...(alternativeTranslations.length > 0 ? { alternativeTranslations } : {}),
      ...(pronunciation ? { pronunciation } : {}),
      translation,
    },
    where: {
      wordTranslation: { userLanguage, wordId: record.id },
    },
  });
}

/**
 * Marks the activity as completed after all data has been saved.
 * Uses a conditional update (only if NOT already completed) to make the
 * operation idempotent without a separate read. This avoids a race condition
 * where the status could change between the read and the update.
 */
async function markActivityAsCompleted(activityId: number, workflowRunId: string): Promise<void> {
  await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { generationStatus: { not: "completed" }, id: activityId },
    }),
  );
}
