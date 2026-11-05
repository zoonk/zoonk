import { type Task } from "@/lib/types";
import { type LessonMarksParams, tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { LESSON_MARKS_SCORE_CATEGORIES } from "./score-categories";
import { type LessonMarksEvalOutput, checkLessonMarks, scoreLessonMarks } from "./scorer";
import { TEST_CASES } from "./test-cases";

type MarksCaseInput = Pick<LessonMarksParams, "ideas" | "language" | "lessonTitle" | "screens">;

/** Scored on what the model wrote, so code checks count what the pipeline drops. */
async function generateLessonMarks(
  input: MarksCaseInput & Pick<LessonMarksParams, "model" | "reasoning" | "useFallback">,
) {
  const result = await tagLesson(input);
  const data: LessonMarksEvalOutput = { marks: result.data, raw: result.output };
  return { ...result, data };
}

export const lessonMarksTask: Task<MarksCaseInput, LessonMarksEvalOutput> = {
  codeChecks: checkLessonMarks,
  description:
    "Tag a written lesson: each screen's idea, underline, example and icon need, and each map idea's about line and icon need",
  generate: generateLessonMarks,
  id: "lesson-marks",
  name: "Lesson Marks",
  score: scoreLessonMarks,
  scoreCategories: LESSON_MARKS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
