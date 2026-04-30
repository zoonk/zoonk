import { type Task } from "@/lib/types";
import {
  type LessonGrammarContentParams,
  type LessonGrammarContentSchema,
  generateLessonGrammarContent,
} from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { TEST_CASES } from "./test-cases";

export const lessonGrammarContentTask: Task<
  LessonGrammarContentParams,
  LessonGrammarContentSchema
> = {
  description:
    "Generate monolingual grammar content (examples + exercises) in the target language only",
  generate: generateLessonGrammarContent,
  id: "lesson-grammar-content",
  name: "Lesson Grammar Content",
  testCases: TEST_CASES,
};
