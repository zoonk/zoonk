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
): Promise<{ wordAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return { wordAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateSentenceWordAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
    return { wordAudioUrls: {} };
  }

  const orgSlug = course.organization.slug;
  const organizationId = course.organization.id;

  const existingAudios = await prisma.word.findMany({
    select: { audioUrl: true, word: true },
    where: {
      audioUrl: { not: null },
      organizationId,
      targetLanguage,
      word: { in: savedSentenceWords.map((saved) => saved.word) },
    },
  });

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    existingAudios.flatMap((record) => (record.audioUrl ? [[record.word, record.audioUrl]] : [])),
  );

  const wordsNeedingAudio = savedSentenceWords.filter(
    (saved) => !saved.wordAudioUrl && !existingAudioUrls[saved.word],
  );

  const results = await Promise.all(
    wordsNeedingAudio.map((saved) => generateAudioForText(saved.word, targetLanguage, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.word.update({
        data: { audioUrl: result.audioUrl },
        select: { audioUrl: true, word: true },
        where: { orgWord: { organizationId, targetLanguage, word: result.text } },
      }),
    ),
  );

  const wordAudioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(
      savedSentenceWords.flatMap((saved) =>
        saved.wordAudioUrl ? [[saved.word, saved.wordAudioUrl]] : [],
      ),
    ),
    ...Object.fromEntries(
      newAudioRecords.flatMap((record) =>
        record.audioUrl ? [[record.word, record.audioUrl]] : [],
      ),
    ),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await stream.error({ reason: "enrichmentFailed", step: "generateSentenceWordAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioUrls };
  }

  await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
  return { wordAudioUrls };
}
