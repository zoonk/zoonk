import { type Task } from "@/lib/types";
import {
  type LessonRomanizationParams,
  type LessonRomanizationSchema,
  generateLessonRomanization,
} from "@zoonk/ai/tasks/lessons/language/romanization";
import { type LessonRomanizationExpected, scoreLessonRomanization } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const lessonRomanizationTask: Task<
  LessonRomanizationParams,
  LessonRomanizationSchema,
  LessonRomanizationExpected
> = {
  description: "Romanize non-Roman script texts using standard transliteration systems",
  generate: generateLessonRomanization,
  id: "lesson-romanization",
  name: "Lesson Romanization",
  score: scoreLessonRomanization,
  testCases: TEST_CASES,
};
