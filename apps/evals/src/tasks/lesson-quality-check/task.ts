import { type Task } from "@/lib/types";
import {
  type CheckLessonQualityParams,
  checkLessonQuality,
} from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { checkWrittenLesson, toReviewedLesson } from "@zoonk/core/library/quality/code-checks";
import { scoreLessonQualityCheck } from "./scorer";
import {
  type LessonQualityCheckExpected,
  type LessonQualityCheckInput,
  TEST_CASES,
} from "./test-cases";

type LessonQualityCheckOutput = Awaited<ReturnType<typeof checkLessonQuality>>["data"];

/** Sol writes lessons, so every candidate reviews a lesson from another family's writer. */
const WRITER_MODEL = "openai/gpt-6-sol";

/** The lesson goes through the same conversion the quality gate uses, so the reviewer sees what learners see. */
function reviewLesson({
  lesson,
  model,
  reasoning,
  useFallback,
  ...context
}: LessonQualityCheckInput &
  Pick<CheckLessonQualityParams, "model" | "reasoning" | "useFallback">) {
  const { screens } = checkWrittenLesson({
    language: context.language,
    lesson,
    level: context.level,
    spec: context.spec,
  });

  return checkLessonQuality({
    ...context,
    activityTemplates: describeActivityTemplates(
      context.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
    lesson: toReviewedLesson({ lesson, screens }),
    model,
    reasoning,
    useFallback,
    writerModel: WRITER_MODEL,
  });
}

export const lessonQualityCheckTask: Task<
  LessonQualityCheckInput,
  LessonQualityCheckOutput,
  LessonQualityCheckExpected
> = {
  description:
    "Review a written lesson as an expert from another model family: block wrong facts, wrong answer keys, jargon before it's explained, filler, level misfits and decorative activities, and pass clean lessons",
  generate: reviewLesson,
  id: "lesson-quality-check",
  name: "Lesson Quality Check",
  score: scoreLessonQualityCheck,
  testCases: TEST_CASES,
};
