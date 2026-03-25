import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

export async function generateSentenceWordAudioStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
): Promise<{ wordAudioIds: Record<string, bigint> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return { wordAudioIds: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateSentenceWordAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
    return { wordAudioIds: {} };
  }

  const orgSlug = course.organization.slug;
  const organizationId = course.organization.id;

  const existingAudios = await prisma.wordAudio.findMany({
    select: { id: true, word: true },
    where: {
      organizationId,
      targetLanguage,
      word: { in: savedSentenceWords.map((saved) => saved.word) },
    },
  });

  const existingAudioIds: Record<string, bigint> = Object.fromEntries(
    existingAudios.map((record) => [record.word, record.id]),
  );

  const wordsNeedingAudio = savedSentenceWords.filter(
    (saved) => !saved.wordAudioId && !existingAudioIds[saved.word],
  );

  const results = await Promise.all(
    wordsNeedingAudio.map((saved) => generateAudioForText(saved.word, targetLanguage, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.wordAudio.upsert({
        create: {
          audioUrl: result.audioUrl,
          organizationId,
          targetLanguage,
          word: result.text,
        },
        select: { id: true, word: true },
        update: { audioUrl: result.audioUrl },
        where: { orgWordAudio: { organizationId, targetLanguage, word: result.text } },
      }),
    ),
  );

  const wordAudioIds: Record<string, bigint> = {
    ...existingAudioIds,
    ...Object.fromEntries(
      savedSentenceWords.flatMap((saved) =>
        saved.wordAudioId ? [[saved.word, saved.wordAudioId]] : [],
      ),
    ),
    ...Object.fromEntries(newAudioRecords.map((record) => [record.word, record.id])),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await stream.error({ reason: "enrichmentFailed", step: "generateSentenceWordAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioIds };
  }

  await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
  return { wordAudioIds };
}
