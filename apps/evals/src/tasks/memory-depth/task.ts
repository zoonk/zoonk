import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { memoryDepthClassifier } from "@zoonk/ai/tasks/v2/memory/depth";
import { type MemoryDepthExpected, type MemoryDepthInput, TEST_CASES } from "./test-cases";

type MemoryDepthOutput = { asksDeeper: boolean };

const route = createBooleanEvaluation({
  classifier: memoryDepthClassifier,
  toOutput: (asksDeeper): MemoryDepthOutput => ({ asksDeeper }),
});

function toLabel(asksDeeper: boolean | undefined): string {
  return asksDeeper ? "deeper" : "base";
}

const scoreMemoryDepth: TaskScorer<MemoryDepthExpected> = ({ output, testCase }) => {
  const { asksDeeper } = JSON.parse(output) as MemoryDepthOutput;
  const expected = testCase.expected?.asksDeeper;
  const classification = { expected: toLabel(expected), predicted: toLabel(asksDeeper) };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; got ${classification.predicted}.`,
      score: asksDeeper === expected ? 10 : 6,
    }),
    classification,
  };
};

/**
 * The question runs as an evaluation question (Jev in production), so both routes ask it through
 * `experimental_evaluate`: a generation model id runs through the evaluation adapter.
 */
export const memoryDepthTask: Task<MemoryDepthInput, MemoryDepthOutput, MemoryDepthExpected> = {
  description:
    "Decide whether a learner's preference notes ask for the deeper, more technical version of lessons",
  evaluate: route,
  generate: route,
  id: "memory-depth",
  name: "Memory Depth",
  score: scoreMemoryDepth,
  testCases: TEST_CASES,
};
