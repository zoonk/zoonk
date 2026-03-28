import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { type ReadingSentence } from "./generate-reading-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates direct distractor words for reading and listening sentence activities.
 *
 * Reading distractors are generated from the target-language sentence.
 * Listening distractors are generated from the learner-language translation sentence.
 * Both are stored directly on `LessonSentence`.
 */
export async function generateSentenceDistractorsStep(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
): Promise<{
  distractors: Record<string, string[]>;
  translationDistractors: Record<string, string[]>;
}> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || sentences.length === 0) {
    return { distractors: {}, translationDistractors: {} };
  }

  const targetLanguage = activity.lesson.chapter.course.targetLanguage ?? "";
  const userLanguage = activity.language;

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateSentenceDistractors" });

  const [distractors, translationDistractors] = await Promise.all([
    generateDirectDistractors({
      entries: sentences.map((sentence) => ({
        input: sentence.sentence,
        key: sentence.sentence,
      })),
      language: targetLanguage,
      shape: "single-word",
    }),
    generateDirectDistractors({
      entries: sentences.map((sentence) => ({
        input: sentence.translation,
        key: sentence.translation,
      })),
      language: userLanguage,
      shape: "single-word",
    }),
  ]);

  await stream.status({ status: "completed", step: "generateSentenceDistractors" });

  return { distractors, translationDistractors };
}
