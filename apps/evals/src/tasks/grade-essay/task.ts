import { type Task } from "@/lib/types";
import {
  type EssayGrade,
  type GradeEssayParams,
  gradeEssay,
} from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { scoreEssayGrade } from "./scorer";
import { type GradeEssayExpected, TEST_CASES } from "./test-cases";

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

export const gradeEssayTask: Task<GradeEssayParams, EssayGrade, GradeEssayExpected> = {
  description:
    "Grade essays with the ENEM competencies, OAB brief sections or custom criteria, with quotes, examples and one next step; code-scored against expected score bands",
  // Texts too short to grade are settled in code and report no usage.
  generate: async (input) => {
    const result = await gradeEssay(input);
    return { ...result, usage: result.usage ?? NO_USAGE };
  },
  id: "grade-essay",
  name: "Grade Essay",
  score: scoreEssayGrade,
  testCases: TEST_CASES,
};
