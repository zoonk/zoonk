import { type Task } from "@/lib/types";
import {
  type GradeTypedAnswerParams,
  type TypedAnswerGrade,
  gradeTypedAnswer,
} from "@zoonk/ai/tasks/grading/grade-typed-answer";
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
  generate: async (input) => {
    const result = await gradeTypedAnswer(input);
    return { ...result, usage: result.usage ?? NO_USAGE };
  },
  id: "grade-typed-answer",
  name: "Grade typed answer",
  priorities: {
    distribution: "private",
    first: "quality",
    reads: "A learner sees right or wrong and feedback",
    reason:
      "A wrong verdict marks a learner wrong for being right; called only after exact matching fails",
    waits: "A learner waits in the answer request",
  },
  score: scoreTypedAnswerGrade,
  testCases: TEST_CASES,
};
