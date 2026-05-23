import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getSourceLessonsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type PracticeLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates practice content from the completed explanation lessons that have
 * not already fed an earlier practice. That keeps each practice focused on the
 * preceding explanation group instead of the whole chapter.
 */
export async function generatePracticeContentStep(
  context: LessonContext,
): Promise<PracticeLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generatePracticeContent" });

  const sourceLessons = await getSourceLessonsSinceLastLessonKind({ context, kind: "practice" });

  if (sourceLessons.length === 0) {
    throw new FatalError("Practice generation needs completed explanation lessons");
  }

  const result = await generateLessonPractice({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    sourceLessons,
  });

  await stream.status({ status: "completed", step: "generatePracticeContent" });

  return { kind: "practice", scenario: result.data.scenario, steps: result.data.steps };
}
