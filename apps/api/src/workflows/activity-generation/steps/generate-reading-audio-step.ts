import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export async function generateReadingAudioStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
): Promise<{ sentenceAudioIds: Record<string, bigint> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { sentenceAudioIds: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await streamStatus({ status: "completed", step: "generateAudio" });
    return { sentenceAudioIds: {} };
  }

  const organizationId = course.organization.id;

  const existingAudios = await prisma.sentenceAudio.findMany({
    select: { id: true, sentence: true },
    where: {
      organizationId,
      sentence: { in: savedSentences.map((saved) => saved.sentence) },
      targetLanguage,
    },
  });

  const existingAudioIds: Record<string, bigint> = Object.fromEntries(
    existingAudios.map((record) => [record.sentence, record.id]),
  );

  const sentencesNeedingAudio = savedSentences.filter((saved) => !existingAudioIds[saved.sentence]);

  const results = await Promise.all(
    sentencesNeedingAudio.map((saved) =>
      generateAudioForText(saved.sentence, targetLanguage, course.organization?.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.sentenceAudio.upsert({
        create: {
          audioUrl: result.audioUrl,
          organizationId,
          sentence: result.text,
          targetLanguage,
        },
        select: { id: true, sentence: true },
        update: { audioUrl: result.audioUrl },
        where: {
          orgSentenceAudio: { organizationId, sentence: result.text, targetLanguage },
        },
      }),
    ),
  );

  const sentenceAudioIds: Record<string, bigint> = {
    ...existingAudioIds,
    ...Object.fromEntries(newAudioRecords.map((record) => [record.sentence, record.id])),
  };

  if (fulfilled.length < sentencesNeedingAudio.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { sentenceAudioIds };
  }

  await streamStatus({ status: "completed", step: "generateAudio" });
  return { sentenceAudioIds };
}
