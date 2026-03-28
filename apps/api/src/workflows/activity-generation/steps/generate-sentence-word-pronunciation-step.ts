import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateWordPronunciations } from "./_utils/generate-word-pronunciations";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates missing pronunciations for target-language words used in sentence
 * activities, including canonical sentence words and reading distractor words.
 */
export async function generateSentenceWordPronunciationStep(
  activities: LessonActivity[],
  words: string[],
): Promise<{ pronunciations: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || words.length === 0) {
    return { pronunciations: {} };
  }

  const course = activity.lesson.chapter.course;

  if (!course.organization) {
    return { pronunciations: {} };
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateSentenceWordPronunciation" });

  const pronunciations = await generateWordPronunciations({
    organizationId: course.organization.id,
    targetLanguage: course.targetLanguage ?? "",
    userLanguage: activity.language,
    words,
  });

  await stream.status({ status: "completed", step: "generateSentenceWordPronunciation" });
  return { pronunciations };
}
