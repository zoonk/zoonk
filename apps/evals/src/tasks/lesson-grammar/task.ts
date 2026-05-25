import { type Task } from "@/lib/types";
import {
  type LessonGrammarParams,
  type LessonGrammarSchema,
  generateLessonGrammar,
} from "@zoonk/ai/tasks/lessons/language/grammar";
import { TEST_CASES } from "./test-cases";

export const lessonGrammarTask: Task<LessonGrammarParams, LessonGrammarSchema> = {
  description: "Generate explanation-first grammar lesson content with examples and practice",
  generate: generateLessonGrammar,
  id: "lesson-grammar",
  name: "Lesson Grammar",
  testCases: TEST_CASES,
};
