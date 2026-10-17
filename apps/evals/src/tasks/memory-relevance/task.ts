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

/**
 * Missing a fact the task needed costs personalization; passing an irrelevant one costs a few
 * tokens and some noise. Both score the same, and per-label accuracy shows which a model does.
 */
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

/** Relevance only runs as an evaluation question (Jev in production), so both routes ask it. */
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
