import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type SavedSentence = {
  sentence: string;
  sentenceId: number;
};

function buildSaveOneSentence(params: {
  activityId: number;
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
}) {
  const { activityId, lessonId, organizationId, targetLanguage, userLanguage } = params;

  return async (readingSentence: ReadingSentence, position: number): Promise<SavedSentence> => {
    const record = await prisma.sentence.upsert({
      create: {
        organizationId,
        romanization: readingSentence.romanization,
        sentence: readingSentence.sentence,
        targetLanguage,
        translation: readingSentence.translation,
        userLanguage,
      },
      update: {
        romanization: readingSentence.romanization,
        translation: readingSentence.translation,
      },
      where: {
        orgSentence: {
          organizationId,
          sentence: readingSentence.sentence,
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
        content: assertStepContent("static", { variant: "readingSentenceRef" }),
        kind: "static",
        position,
        sentenceId,
      },
    });

    return { sentence: readingSentence.sentence, sentenceId: Number(sentenceId) };
  };
}

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
    await streamStatus({ status: "error", step: "saveSentences" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { savedSentences: [] };
  }

  await streamStatus({ status: "completed", step: "saveSentences" });
  return { savedSentences };
}
