import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import realLessons from "./real-lessons.json";

type LessonWriterInput = Omit<
  WriteLessonDraftParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const [recorded] = realLessons;

if (!recorded) {
  throw new Error("real-lessons.json lost its first lesson");
}

/** The production plan (8 Nov 2026) whose briefs cite art. 4º, § 1º of Lei 12.813/2013 for a rule in § 2º. */
export const WRONG_PARAGRAPH_PLAN = recorded.context as LessonWriterInput;
