import { type Task } from "@/lib/types";
import { type WriteLessonDraftParams, writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { LESSON_WRITER_SCORE_CATEGORIES } from "./score-categories";
import { scoreLessonWriter } from "./scorer";
import { TEST_CASES } from "./test-cases";

type LessonWriterOutput = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

export const lessonWriterTask: Task<
  Omit<WriteLessonDraftParams, "analytics" | "model" | "reasoning" | "useFallback">,
  LessonWriterOutput
> = {
  description:
    "Write a lesson from its spec: a hook, the idea in small screens, checks with a reason per option, worked examples, calculations as data, planned activities, an application and the summary card",
  generate: writeLessonDraft,
  id: "lesson-writer",
  name: "Lesson Writer",
  score: scoreLessonWriter,
  scoreCategories: LESSON_WRITER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
