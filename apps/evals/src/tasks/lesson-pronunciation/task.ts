import { type Task } from "@/lib/types";
import {
  type LessonPronunciationParams,
  type LessonPronunciationSchema,
  generateLessonPronunciation,
} from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { TEST_CASES } from "./test-cases";

export const lessonPronunciationTask: Task<LessonPronunciationParams, LessonPronunciationSchema> = {
  description: "Generate pronunciation guides using native language phonemes for language learners",
  generate: generateLessonPronunciation,
  id: "lesson-pronunciation",
  name: "Lesson Pronunciation",
  testCases: TEST_CASES,
};
