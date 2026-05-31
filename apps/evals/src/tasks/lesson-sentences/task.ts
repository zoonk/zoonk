import { type Task } from "@/lib/types";
import {
  type LessonSentencesParams,
  type LessonSentencesSchema,
  generateLessonSentences,
} from "@zoonk/ai/tasks/lessons/language/sentences";
import { TEST_CASES } from "./test-cases";

export const lessonSentencesTask: Task<LessonSentencesParams, LessonSentencesSchema> = {
  description: "Generate practice sentences from language lesson metadata",
  generate: generateLessonSentences,
  id: "lesson-sentences",
  name: "Lesson Sentences",
  testCases: TEST_CASES,
};
