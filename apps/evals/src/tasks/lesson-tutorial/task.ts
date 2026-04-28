import { type Task } from "@/lib/types";
import {
  type LessonTutorialParams,
  type LessonTutorialSchema,
  generateLessonTutorial,
} from "@zoonk/ai/tasks/lessons/tutorial";
import { TEST_CASES } from "./test-cases";

export const lessonTutorialTask: Task<LessonTutorialParams, LessonTutorialSchema> = {
  description: "Generate procedural steps for a tutorial lesson",
  generate: generateLessonTutorial,
  id: "lesson-tutorial",
  name: "Lesson Tutorial",
  testCases: TEST_CASES,
};
