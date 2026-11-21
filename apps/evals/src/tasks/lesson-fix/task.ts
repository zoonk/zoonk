import { type OptionalCountry, type Task } from "@/lib/types";
import { type FixLessonDraftParams, fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { scoreLessonFix } from "./scorer";
import { type LessonFixExpected, TEST_CASES } from "./test-cases";

type LessonFixOutput = Awaited<ReturnType<typeof fixLessonDraft>>["data"];

export const lessonFixTask: Task<
  OptionalCountry<Omit<FixLessonDraftParams, "analytics" | "model" | "reasoning" | "useFallback">>,
  LessonFixOutput,
  LessonFixExpected
> = {
  description:
    "Fix only the lesson screens the quality gate flagged, so the lesson passes the code checks",
  generate: (input) => fixLessonDraft({ ...input, country: input.country ?? null }),
  id: "lesson-fix",
  name: "Lesson fix",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "A checker re-reads the fixed draft, then learners read it",
    reason: "Fixes shared lessons; runs on the writer's model",
    waits: "With the lesson's wait; rechecks run in the background",
  },
  score: scoreLessonFix,
  testCases: TEST_CASES,
};
