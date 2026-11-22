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
  name: "Lesson laws",
  priorities: {
    distribution: "shared",
    first: "cost",
    reads: "Code fetches the law articles it names",
    reason: "Code checks the answer; the cheapest that filed every article under the right law",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreLessonLaws,
  testCases: TEST_CASES,
};
