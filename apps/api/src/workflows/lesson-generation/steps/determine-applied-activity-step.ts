import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateAppliedActivityKind } from "@zoonk/ai/tasks/lessons/applied-activity-kind";
import { type AppliedActivityKind, type LessonStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

/**
 * Classifies whether this core lesson should include an applied activity
 * (story, investigation, etc).
 *
 * Non-fatal: if the classifier fails, the lesson proceeds without an
 * applied activity. This is an optional enhancement, not a structural
 * requirement.
 */
export async function determineAppliedActivityStep(
  context: LessonContext,
): Promise<AppliedActivityKind> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "determineAppliedActivity" });

  const { data: result, error } = await safeAsync(() =>
    generateAppliedActivityKind({
      chapterTitle: context.chapter.title,
      concepts: context.concepts,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description ?? "",
      lessonTitle: context.title,
    }),
  );

  await stream.status({ status: "completed", step: "determineAppliedActivity" });

  if (error) {
    return null;
  }

  return result.data.appliedActivityKind;
}
