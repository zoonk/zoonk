import { type Task } from "@/lib/types";
import {
  type LessonGrammarUserContentParams,
  type LessonGrammarUserContentSchema,
  generateLessonGrammarUserContent,
} from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { TEST_CASES } from "./test-cases";

export const lessonGrammarUserContentTask: Task<
  LessonGrammarUserContentParams,
  LessonGrammarUserContentSchema
> = {
  description:
    "Generate user-language content (translations, discovery question, rule summary, feedback) for grammar lessons",
  generate: generateLessonGrammarUserContent,
  id: "lesson-grammar-user-content",
  name: "Lesson Grammar User Content",
  testCases: TEST_CASES,
};
