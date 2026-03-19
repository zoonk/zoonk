import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  deduplicateNormalizedTexts,
  emptyToNull,
  normalizePunctuation,
  normalizeString,
} from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type SavedSentence = {
  sentence: string;
  sentenceId: number;
};

// Save one clean copy of each alternative so the database does not store duplicates that
// only differ by formatting.
// Example: keep "Bonjour!" once instead of saving both "Bonjour!" and " Bonjour ! ".
function normalizeAlternativeTexts(primaryText: string, alternatives: string[]): string[] {
  const primaryKey = normalizeString(normalizePunctuation(primaryText).trim());

  return deduplicateNormalizedTexts(alternatives).filter(
    (text) => normalizeString(text) !== primaryKey,
  );
}

// Capture the lesson and activity ids once so the save loop only has to provide the
// sentence being saved and its position.
function buildSaveOneSentence(params: {
  activityId: number;
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
}) {
  const { activityId, lessonId, organizationId, targetLanguage, userLanguage } = params;

  return async (readingSentence: ReadingSentence, position: number): Promise<SavedSentence> => {
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

    const record = await prisma.sentence.upsert({
      create: {
        alternativeSentences,
        alternativeTranslations,
        explanation: emptyToNull(readingSentence.explanation),
        organizationId,
        romanization: emptyToNull(readingSentence.romanization),
        sentence,
        targetLanguage,
        translation,
        userLanguage,
      },
      update: {
        alternativeSentences,
        alternativeTranslations,
        explanation: emptyToNull(readingSentence.explanation),
        romanization: emptyToNull(readingSentence.romanization),
        translation,
      },
      where: {
        orgSentence: {
          organizationId,
          sentence,
          targetLanguage,
          userLanguage,
        },
      },
    });

    const sentenceId = record.id;

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

    return { sentence, sentenceId: Number(sentenceId) };
  };
}

// Save each reading sentence, link it to the lesson, and create the reading steps that
// point to those saved sentences.
export async function saveReadingSentencesStep(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
): Promise<{ savedSentences: SavedSentence[] }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return { savedSentences: [] };
  }

  await streamStatus({ status: "started", step: "saveSentences" });

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { savedSentences: [] };
  }

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;
  const organizationId = course.organization.id;

  const saveOneSentence = buildSaveOneSentence({
    activityId: activity.id,
    lessonId: activity.lessonId,
    organizationId,
    targetLanguage,
    userLanguage,
  });

  const { data: savedSentences, error } = await safeAsync(() =>
    Promise.all(sentences.map((sentence, index) => saveOneSentence(sentence, index))),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "saveSentences" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { savedSentences: [] };
  }

  await streamStatus({ status: "completed", step: "saveSentences" });
  return { savedSentences };
}
