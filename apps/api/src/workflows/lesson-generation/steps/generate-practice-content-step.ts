import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getSourceLessonsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type PracticeLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates practice content from explanation lesson metadata that has not
 * already fed an earlier practice. The source lessons do not need generated
 * content because title and description carry the practice scope.
 */
export async function generatePracticeContentStep(
  context: LessonContext,
): Promise<PracticeLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generatePracticeContent" });

  const sourceLessons = await getSourceLessonsSinceLastLessonKind({ context, kind: "practice" });

  if (sourceLessons.length === 0) {
    throw new FatalError("Practice generation needs explanation lesson metadata");
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
