import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates audio URLs for reading sentences using TTS.
 * Checks existing Sentence records by text to skip sentences that already have audio.
 * Returns the audio URL map without writing to the database — the save step
 * persists the results.
 */
export async function generateReadingAudioStep(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
): Promise<{ sentenceAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return { sentenceAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

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
      sentence: { in: sentences.map((entry) => entry.sentence) },
      targetLanguage,
    },
  });

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.sentence, record.audioUrl]] : [],
    ),
  );

  const sentencesNeedingAudio = sentences.filter((entry) => !existingAudioUrls[entry.sentence]);

  const results = await Promise.all(
    sentencesNeedingAudio.map((entry) =>
      generateAudioForText(entry.sentence, targetLanguage, course.organization?.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const sentenceAudioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(fulfilled.map((result) => [result.text, result.audioUrl])),
  };

  await stream.status({ status: "completed", step: "generateAudio" });
  return { sentenceAudioUrls };
}
