import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { evaluateQuestions } from "@zoonk/ai/evaluate/evaluate-questions";
import { type MemoryGateVerdict, decideMemoryGate } from "@zoonk/ai/tasks/v2/memory/decisions";
import { memoryGateClassifier } from "@zoonk/ai/tasks/v2/memory/gate";
import { isJsonObject } from "@zoonk/utils/json";
import { type MemoryGateExpected, type MemoryGateInput, TEST_CASES } from "./test-cases";

type MemoryGateOutput = Pick<MemoryGateVerdict, "decision">;

async function gateCandidate({ candidate, model }: MemoryGateInput & { model: string }) {
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
    data: { decision: decideMemoryGate(probabilities).decision },
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
