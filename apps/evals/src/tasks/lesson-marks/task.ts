import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { type LessonMarksParams, tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
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
  criteria: readCriteria(LESSON_MARKS_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Tag a written lesson: each screen's idea, underline, example and icon need, and each map idea's about line and icon need",
  generate: generateLessonMarks,
  id: "lesson-marks",
  name: "Lesson marks",
  priorities: {
    comparison: {
      criteria: {
        about: "counts",
        icons: "counts",
        ideas: "counts",
        marks: "counts",
        plainLanguage: "counts",
      },
      preference: "separates",
      trade: COMPARISON_TRADES.shared,
    },
    distribution: "shared",
    first: "cost",
    reads: "A learner sees the about lines, marks and icons on the lesson",
    reason: "Shared marks; the cheapest at minimal reasoning that also gave least away",
    waits: "Set by the caller, in lesson marking",
  },
  score: scoreLessonMarks,
  scoreCategories: LESSON_MARKS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
