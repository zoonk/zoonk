import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";
import { type Task } from "@/lib/types";
import {
  EXAM_IDENTITY_INSTRUCTIONS,
  type ExamDescription,
  evaluateExamIdentityPair,
  isSameExam,
} from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import { TEST_CASES } from "./test-cases";

export type ExamIdentityInput = { candidate: ExamDescription; request: ExamDescription };
export type ExamIdentityExpected = { same: "true" | "false" };

/** Evaluation models answer the pair; the verdict uses the production threshold. */
async function decidePair(input: ExamIdentityInput & { model: string }) {
  const run = await evaluateExamIdentityPair({
    candidate: input.candidate,
    model: input.model,
    request: input.request,
  });

  return {
    data: { same: String(isSameExam(run.probability)) },
    probabilities: { true: run.probability },
    systemPrompt: EXAM_IDENTITY_INSTRUCTIONS,
    usage: run.usage,
    userPrompt: run.state,
  };
}

export const examIdentityDecisionTask: Task<
  ExamIdentityInput,
  { same: string },
  ExamIdentityExpected
> = {
  description: "Decide whether a stored exam blueprint is the requested exam under another name",
  evaluate: decidePair,
  generate: decidePair,
  id: "exam-identity-decision",
  name: "Exam Identity Decision",
  score: createDeterministicStringFieldScorer<ExamIdentityExpected>({
    expectedLabel: "Expected",
    field: "same",
    generatedLabel: "Generated",
    getAcceptedValues: (expected) => (expected ? [expected.same] : []),
    reportsLabels: true,
  }),
  testCases: TEST_CASES,
};
