import { type Task } from "@/lib/types";
import {
  type LessonLaw,
  type LessonLawsParams,
  generateLessonLaws,
} from "@zoonk/ai/tasks/lesson-laws";
import { type LessonLawsExpected, scoreLessonLaws } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const lessonLawsTask: Task<LessonLawsParams, { laws: LessonLaw[] }, LessonLawsExpected> = {
  description:
    "Name the laws whose numbered provisions a lesson teaches, where their official text is published and the articles to read",
  generate: generateLessonLaws,
  id: "lesson-laws",
  name: "Lesson Laws",
  score: scoreLessonLaws,
  testCases: TEST_CASES,
};
