import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import {
  type ActivityGrammarEnrichmentSchema,
  generateActivityGrammarEnrichment,
} from "@zoonk/ai/tasks/activities/language/grammar-enrichment";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates USER_LANGUAGE enrichment for grammar content: translations,
 * discovery question, rule name/summary, and exercise feedback.
 * Runs in parallel with romanization since neither depends on the other.
 */
export async function generateGrammarEnrichmentStep(
  activities: LessonActivity[],
  grammarContent: ActivityGrammarContentSchema,
): Promise<{ enrichment: ActivityGrammarEnrichmentSchema | null }> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return { enrichment: null };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateGrammarEnrichment" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? course.title;
  const userLanguage = activity.language;

  const { data: result, error }: SafeReturn<{ data: ActivityGrammarEnrichmentSchema }> =
    await safeAsync(() =>
      generateActivityGrammarEnrichment({
        chapterTitle: activity.lesson.chapter.title,
        examples: grammarContent.examples,
        exercises: grammarContent.exercises,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        targetLanguage,
        userLanguage,
      }),
    );

  if (error || !result) {
    const reason = error ? "aiGenerationFailed" : "aiEmptyResult";
    await stream.error({ reason, step: "generateGrammarEnrichment" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { enrichment: null };
  }

  await stream.status({ status: "completed", step: "generateGrammarEnrichment" });
  return { enrichment: result.data };
}
