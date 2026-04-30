import { type Task } from "@/lib/types";
import {
  type LessonRomanizationParams,
  type LessonRomanizationSchema,
  generateLessonRomanization,
} from "@zoonk/ai/tasks/lessons/language/romanization";
import { TEST_CASES } from "./test-cases";

export const lessonRomanizationTask: Task<LessonRomanizationParams, LessonRomanizationSchema> = {
  description: "Romanize non-Roman script texts using standard transliteration systems",
  generate: generateLessonRomanization,
  id: "lesson-romanization",
  name: "Lesson Romanization",
  testCases: TEST_CASES,
};
