import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type MemoryRelevanceInput,
  memoryRelevanceClassifier,
} from "@zoonk/ai/tasks/v2/memory/relevance";
import { isJsonObject } from "@zoonk/utils/json";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type MemoryRelevanceExpected, TEST_CASES } from "./test-cases";

type MemoryRelevanceOutput = { relevant: boolean };

const route = createBooleanEvaluation({
  classifier: memoryRelevanceClassifier,
  toOutput: (relevant): MemoryRelevanceOutput => ({ relevant }),
});

function toLabel(relevant: boolean | null): string | null {
  if (relevant === null) {
    return null;
  }

  return relevant ? "relevant" : "irrelevant";
}

function getRelevant(output: string): boolean | null {
  try {
    const parsed: unknown = JSON.parse(output);
    return isJsonObject(parsed) && typeof parsed.relevant === "boolean" ? parsed.relevant : null;
  } catch {
    return null;
  }
}

const scoreMemoryRelevance: TaskScorer<MemoryRelevanceExpected> = ({ output, testCase }) => {
  const relevant = getRelevant(output);
  const expected = testCase.expected?.relevant ?? false;
  const classification = { expected: toLabel(expected) ?? "", predicted: toLabel(relevant) };

  return {
    ...createFixedScore({
      conclusion: relevant === expected ? "None" : `Expected ${classification.expected}.`,
      score: relevant === expected ? 10 : 6,
    }),
    classification,
  };
};

export const memoryRelevanceTask: Task<
  MemoryRelevanceInput,
  MemoryRelevanceOutput,
  MemoryRelevanceExpected
> = {
  description: "Decide whether an AI task should read one fact from a learner's memory",
  evaluate: route,
  generate: route,
  id: "memory-relevance",
  name: "Memory Relevance",
  score: scoreMemoryRelevance,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
