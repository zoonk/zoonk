import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export async function generateReadingAudioStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
): Promise<{ sentenceAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { sentenceAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateAudio" });
    return { sentenceAudioUrls: {} };
  }

  const organizationId = course.organization.id;

  const existingAudios = await prisma.sentence.findMany({
    select: { audioUrl: true, sentence: true },
    where: {
      audioUrl: { not: null },
      organizationId,
      sentence: { in: savedSentences.map((saved) => saved.sentence) },
      targetLanguage,
    },
  });

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.sentence, record.audioUrl]] : [],
    ),
  );

  const sentencesNeedingAudio = savedSentences.filter(
    (saved) => !existingAudioUrls[saved.sentence],
  );

  const results = await Promise.all(
    sentencesNeedingAudio.map((saved) =>
      generateAudioForText(saved.sentence, targetLanguage, course.organization?.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.sentence.update({
        data: { audioUrl: result.audioUrl },
        select: { audioUrl: true, sentence: true },
        where: {
          orgSentence: { organizationId, sentence: result.text, targetLanguage },
        },
      }),
    ),
  );

  const sentenceAudioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(
      newAudioRecords.flatMap((record) =>
        record.audioUrl ? [[record.sentence, record.audioUrl]] : [],
      ),
    ),
  };

  if (fulfilled.length < sentencesNeedingAudio.length) {
    await stream.error({ reason: "audioGenerationFailed", step: "generateAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { sentenceAudioUrls };
  }

  await stream.status({ status: "completed", step: "generateAudio" });
  return { sentenceAudioUrls };
}
