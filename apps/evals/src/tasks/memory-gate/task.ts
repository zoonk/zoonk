import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { evaluateQuestions } from "@zoonk/ai/evaluate/evaluate-questions";
import { type MemoryGateVerdict, decideMemoryGate } from "@zoonk/ai/tasks/v2/memory/decisions";
import { memoryGateClassifier } from "@zoonk/ai/tasks/v2/memory/gate";
import { isJsonObject } from "@zoonk/utils/json";
import { type MemoryGateExpected, type MemoryGateInput, TEST_CASES } from "./test-cases";

type MemoryGateOutput = Pick<MemoryGateVerdict, "decision">;

/**
 * Runs the production questions with the requested model and no fallback, so each row measures
 * that model, and turns the probabilities into the production verdict.
 */
async function gateCandidate({
  allowSensitive,
  candidate,
  model,
}: MemoryGateInput & { model: string }) {
  const { answers, state, usage } = await evaluateQuestions({
    fallbackModel: model,
    input: memoryGateClassifier.toInput(candidate),
    model,
    questions: memoryGateClassifier.questions,
    task: "memory-gate",
  });

  const probabilities = {
    explicitlyAsked: answers.explicitlyAsked.probability,
    lasting: answers.lasting.probability,
    sensitive: answers.sensitive.probability,
  };

  return {
    data: { decision: decideMemoryGate({ allowSensitive, probabilities }).decision },
    probabilities,
    systemPrompt: memoryGateClassifier.questions.lasting.instructions,
    usage,
    userPrompt: state,
  };
}

function getDecision(output: string): string | null {
  try {
    const parsed: unknown = JSON.parse(output);
    return isJsonObject(parsed) && typeof parsed.decision === "string" ? parsed.decision : null;
  } catch {
    return null;
  }
}

/**
 * Keeping a sensitive fact the learner didn't ask for is the costly mistake, so it scores lowest;
 * dropping a fact worth keeping loses personalization and scores in between.
 */
const scoreMemoryGate: TaskScorer<MemoryGateExpected> = ({ output, testCase }) => {
  const decision = getDecision(output);
  const expected = testCase.expected?.decision ?? "keep";
  const classification = { expected, predicted: decision };

  if (decision === expected) {
    return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
  }

  const keptSensitive = expected === "sensitive" && decision === "keep";
  const conclusion = `Expected ${expected}; got ${decision ?? "no decision"}.`;

  return { ...createFixedScore({ conclusion, score: keptSensitive ? 6 : 7 }), classification };
};

/** The gate only runs as evaluation questions (Jev in production), so both routes ask them. */
export const memoryGateTask: Task<MemoryGateInput, MemoryGateOutput, MemoryGateExpected> = {
  description:
    "Decide whether a candidate memory fact is lasting and, when sensitive, whether an adult explicitly asked to keep it",
  evaluate: gateCandidate,
  generate: gateCandidate,
  id: "memory-gate",
  name: "Memory Gate",
  score: scoreMemoryGate,
  testCases: TEST_CASES,
};
