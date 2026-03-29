import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordAudioUrls } from "./_utils/generate-word-audio-urls";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates audio URLs for individual words extracted from reading sentences.
 * Checks existing Word records by text to skip words that already have audio.
 * Returns the audio URL map without writing to the database — the save step
 * persists the results.
 */
export async function generateSentenceWordAudioStep(
  activities: LessonActivity[],
  words: string[],
): Promise<{ wordAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || words.length === 0) {
    return { wordAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateSentenceWordAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
    return { wordAudioUrls: {} };
  }

  const wordAudioUrls = await generateWordAudioUrls({
    orgSlug: course.organization.slug,
    organizationId: course.organization.id,
    targetLanguage,
    words,
  });

  await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
  return { wordAudioUrls };
}
