import { type Task } from "@/lib/types";
import {
  type GradeTypedAnswerParams,
  type TypedAnswerGrade,
  gradeTypedAnswer,
} from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { evaluateTypedAnswerKeyPoints } from "./key-point-evaluation";
import { scoreTypedAnswerGrade } from "./scorer";
import { type GradeTypedAnswerExpected, TEST_CASES } from "./test-cases";

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

export const gradeTypedAnswerTask: Task<
  GradeTypedAnswerParams,
  TypedAnswerGrade,
  GradeTypedAnswerExpected
> = {
  description:
    "Grade typed and spoken answers key point by key point after a code pre-check; code-scored against a teacher's verdicts (typed-answer equivalence)",
  evaluate: evaluateTypedAnswerKeyPoints,
  // Answers settled by the code pre-check report no usage because no model ran.
  generate: async (input) => {
    const result = await gradeTypedAnswer(input);
    return { ...result, usage: result.usage ?? NO_USAGE };
  },
  id: "grade-typed-answer",
  name: "Grade Typed Answer",
  score: scoreTypedAnswerGrade,
  testCases: TEST_CASES,
};
