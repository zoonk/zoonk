import { type Task } from "@/lib/types";
import { type FixLessonDraftParams, fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { scoreLessonFix } from "./scorer";
import { type LessonFixExpected, TEST_CASES } from "./test-cases";

type LessonFixOutput = Awaited<ReturnType<typeof fixLessonDraft>>["data"];

export const lessonFixTask: Task<
  Omit<FixLessonDraftParams, "analytics" | "model" | "reasoning" | "useFallback">,
  LessonFixOutput,
  LessonFixExpected
> = {
  description:
    "Fix only the lesson screens the quality gate flagged, so the lesson passes the code checks",
  generate: fixLessonDraft,
  id: "lesson-fix",
  name: "Lesson Fix",
  score: scoreLessonFix,
  testCases: TEST_CASES,
};
