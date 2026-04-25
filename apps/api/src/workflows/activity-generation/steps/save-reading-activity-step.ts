import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { safeAsync } from "@zoonk/utils/error";
import { emptyToNull, normalizePunctuation } from "@zoonk/utils/string";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type WordMetadataEntry, saveReadingTargetWords } from "./_utils/save-reading-target-words";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Persists canonical reading sentences, their direct distractor arrays, and the
 * target-language word metadata needed by the player.
 *
 * Canonical sentence words still become `LessonWord` rows because their translations are
 * lesson-scoped. Generated distractor words become only `Word` plus `WordPronunciation`
 * records so they can render audio and romanization without polluting the lesson
 * vocabulary.
 */
export async function saveReadingActivityStep(params: {
  activities: LessonActivity[];
  distractors: Record<string, string[]>;
  pronunciations: Record<string, string>;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  sentences: ReadingSentence[];
  translationDistractors: Record<string, string[]>;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const {
    activities,
    distractors,
    pronunciations,
    sentenceAudioUrls,
    sentenceRomanizations,
    sentences,
    translationDistractors,
    wordAudioUrls,
    wordMetadata,
    workflowRunId,
  } = params;

  const activity = findActivityByKind(activities, "reading");

  if (!activity) {
    return;
  }

  if (sentences.length === 0) {
    throw new Error("Reading save step received no sentences");
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    throw new Error("Reading save step needs course organization data");
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "saveReadingActivity" });

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;
  const organizationId = course.organization.id;

  const { error: sentenceError } = await safeAsync(() =>
    Promise.all(
      sentences.map((readingSentence, position) =>
        saveOneSentence({
          activityId: activity.id,
          distractors,
          lessonId: activity.lessonId,
          organizationId,
          position,
          readingSentence,
          sentenceAudioUrls,
          sentenceRomanizations,
          targetLanguage,
          translationDistractors,
          userLanguage,
        }),
      ),
    ),
  );

  if (sentenceError) {
    throw sentenceError;
  }

  const { error: wordError } = await safeAsync(() =>
    saveReadingTargetWords({
      distractors,
      lessonId: activity.lessonId,
      organizationId,
      pronunciations,
      sentences,
      targetLanguage,
      userLanguage,
      wordAudioUrls,
      wordMetadata,
    }),
  );

  if (wordError) {
    throw wordError;
  }

  await markActivityAsCompleted(activity.id, workflowRunId);

  await stream.status({ status: "completed", step: "saveReadingActivity" });
}

/**
 * Saves one canonical sentence and its lesson-scoped distractor arrays.
 *
 * The sentence table stores only the canonical target-language sentence plus shared audio
 * and romanization. Direct distractor arrays live on `LessonSentence` because they are
 * lesson-scoped exercise data.
 */
async function saveOneSentence(params: {
  activityId: string;
  distractors: Record<string, string[]>;
  lessonId: string;
  organizationId: string;
  position: number;
  readingSentence: ReadingSentence;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  targetLanguage: string;
  translationDistractors: Record<string, string[]>;
  userLanguage: string;
}): Promise<void> {
  const {
    activityId,
    distractors,
    lessonId,
    organizationId,
    position,
    readingSentence,
    sentenceAudioUrls,
    sentenceRomanizations,
    targetLanguage,
    translationDistractors,
    userLanguage,
  } = params;

  const sentence = normalizePunctuation(readingSentence.sentence);
  const translation = normalizePunctuation(readingSentence.translation);
  const sentenceDistractors = sanitizeDistractors({
    distractors: distractors[readingSentence.sentence] ?? [],
    input: readingSentence.sentence,
    shape: "single-word",
  });
  const sentenceTranslationDistractors = sanitizeDistractors({
    distractors: translationDistractors[readingSentence.translation] ?? [],
    input: readingSentence.translation,
    shape: "single-word",
  });
  const audioUrl = sentenceAudioUrls[readingSentence.sentence] ?? null;
  const romanization = sentenceRomanizations[readingSentence.sentence] ?? null;

  const record = await prisma.sentence.upsert({
    create: {
      audioUrl,
      organizationId,
      romanization,
      sentence,
      targetLanguage,
    },
    update: {
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

  await prisma.lessonSentence.upsert({
    create: {
      distractors: sentenceDistractors,
      explanation: emptyToNull(readingSentence.explanation),
      lessonId,
      sentenceId: record.id,
      translation,
      translationDistractors: sentenceTranslationDistractors,
      userLanguage,
    },
    update: {
      distractors: sentenceDistractors,
      explanation: emptyToNull(readingSentence.explanation),
      translation,
      translationDistractors: sentenceTranslationDistractors,
    },
    where: { lessonSentence: { lessonId, sentenceId: record.id } },
  });

  await prisma.step.create({
    data: {
      activityId,
      content: assertStepContent("reading", {}),
      isPublished: true,
      kind: "reading",
      position,
      sentenceId: record.id,
    },
  });
}

/**
 * Marks the activity as completed after all data has been saved.
 * Uses updateMany so "no matching row" (already completed) returns count=0
 * instead of throwing. Real DB errors still propagate to the caller.
 */
async function markActivityAsCompleted(activityId: string, workflowRunId: string): Promise<void> {
  await prisma.activity.updateMany({
    data: { generationRunId: workflowRunId, generationStatus: "completed" },
    where: { generationStatus: { not: "completed" }, id: activityId },
  });
}
