import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import {
  type ActivityGrammarUserContentSchema,
  generateActivityGrammarUserContent,
} from "@zoonk/ai/tasks/activities/language/grammar-user-content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates USER_LANGUAGE content for grammar activities: translations,
 * discovery question, rule name/summary, and exercise feedback.
 * Runs in parallel with romanization since neither depends on the other.
 */
export async function generateGrammarUserContentStep(
  activities: LessonActivity[],
  grammarContent: ActivityGrammarContentSchema,
): Promise<{ userContent: ActivityGrammarUserContentSchema | null }> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return { userContent: null };
  }

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateGrammarUserContent" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? course.title;
  const userLanguage = activity.language;

  const { data: result, error }: SafeReturn<{ data: ActivityGrammarUserContentSchema }> =
    await safeAsync(() =>
      generateActivityGrammarUserContent({
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
    throw error ?? new Error("aiEmptyResult");
  }

  await stream.status({ status: "completed", step: "generateGrammarUserContent" });
  return { userContent: result.data };
}
