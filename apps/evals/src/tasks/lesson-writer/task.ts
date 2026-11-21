import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task } from "@/lib/types";
import { type WriteLessonDraftParams, writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { readCriteria } from "../plain-language-criterion";
import { LESSON_WRITER_SCORE_CATEGORIES } from "./score-categories";
import { checkLessonWriterOutput, scoreLessonWriter } from "./scorer";
import { TEST_CASES } from "./test-cases";

type LessonWriterOutput = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

export const lessonWriterTask: Task<
  OptionalCountry<
    Omit<WriteLessonDraftParams, "analytics" | "model" | "reasoning" | "useFallback">
  >,
  LessonWriterOutput
> = {
  codeChecks: checkLessonWriterOutput,
  criteria: readCriteria(LESSON_WRITER_SCORE_CATEGORIES),
  description:
    "Write a lesson from its spec: a hook, the idea in small screens, checks with a reason per option, worked examples, calculations as data, planned activities, an application and the summary card",
  generate: (input) => writeLessonDraft({ ...input, country: input.country ?? null }),
  id: "lesson-writer",
  name: "Lesson writer",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        checks: "counts",
        clarity: "counts",
        fitAndApplication: "counts",
        teacher: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads the lesson",
    reason:
      "Shared lessons spread a pricier model's cost over many readers; personal lessons use a cheaper model",
    waits: "A learner waits when the lesson is opened live; otherwise prepared ahead",
  },
  requiresAnswerKeyCheck: true,
  score: scoreLessonWriter,
  scoreCategories: LESSON_WRITER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
