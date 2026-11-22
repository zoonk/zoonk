import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type GenerateLessonQuestionAnswerParams,
  type LessonQuestionAnswerSchema,
  generateLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import { PLAIN_LANGUAGE_CRITERION } from "../plain-language-criterion";
import { LEARNER_NEEDS_CASES } from "./learner-needs-cases";
import { TEST_CASES } from "./test-cases";

export const lessonQuestionTask: Task<
  GenerateLessonQuestionAnswerParams,
  LessonQuestionAnswerSchema
> = {
  criteria: [PLAIN_LANGUAGE_CRITERION],
  description: "Answer learner questions using lesson, step, and validated answer context",
  generate: generateLessonQuestionAnswer,
  id: "lesson-question",
  name: "Lesson question",
  priorities: {
    comparison: {
      criteria: { plainLanguage: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.private,
    },
    distribution: "private",
    first: "cost",
    reads: "A learner reads the streamed answer to their question",
    reason: "One learner's question; code doesn't say why the main model was chosen",
    waits: "A learner waits: the answer streams",
  },
  testCases: [...TEST_CASES, ...LEARNER_NEEDS_CASES],
};
