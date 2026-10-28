import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { classify } from "@zoonk/ai/evaluate/classify";
import {
  type MemoryReconcileAction,
  decideMemoryReconcile,
} from "@zoonk/ai/tasks/v2/memory/decisions";
import {
  type MemoryReconcileInput,
  memoryReconcileClassifier,
} from "@zoonk/ai/tasks/v2/memory/reconcile";
import { isJsonObject } from "@zoonk/utils/json";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type MemoryReconcileExpected, TEST_CASES } from "./test-cases";

type MemoryReconcileOutput = { action: string };

function toLabel(action: MemoryReconcileAction): string {
  return "index" in action ? `${action.action}_${action.index + 1}` : action.action;
}

async function reconcileFact({ model, ...input }: MemoryReconcileInput & { model: string }) {
  const result = await classify({
    fallbackModel: model,
    input: memoryReconcileClassifier.toInput(input),
    instructions: memoryReconcileClassifier.instructions,
    labels: memoryReconcileClassifier.getLabels(input),
    model,
    task: "memory-reconcile",
  });

  const action = decideMemoryReconcile({
    choice: result.choice,
    existingCount: input.existing.length,
    intent: input.fact.intent,
    probabilities: result.probabilities,
  });

  return {
    data: { action: toLabel(action) },
    probabilities: result.probabilities ? { ...result.probabilities } : undefined,
    systemPrompt: memoryReconcileClassifier.instructions,
    usage: result.usage,
    userPrompt: result.state,
  };
}

function getAction(output: string): string | null {
  try {
    const parsed: unknown = JSON.parse(output);
    return isJsonObject(parsed) && typeof parsed.action === "string" ? parsed.action : null;
  } catch {
    return null;
  }
}

function toKind(label: string | null): string | null {
  return label?.split("_")[0] ?? null;
}

const scoreMemoryReconcile: TaskScorer<MemoryReconcileExpected> = ({ output, testCase }) => {
  const action = getAction(output);
  const accepted = testCase.expected?.actions ?? [];

  const classification = {
    expected: toKind(accepted[0] ?? null) ?? "add",
    predicted: toKind(action),
  };

  if (action && accepted.includes(action)) {
    return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
  }

  const destructive = action?.startsWith("replace") || action?.startsWith("remove");
  const conclusion = `Expected ${accepted.join(" or ")}; got ${action ?? "no action"}.`;

  return { ...createFixedScore({ conclusion, score: destructive ? 6 : 7 }), classification };
};

export const memoryReconcileTask: Task<
  MemoryReconcileInput,
  MemoryReconcileOutput,
  MemoryReconcileExpected
> = {
  description:
    "Decide whether a new memory fact is added, ignored as a repeat, replaces an existing fact or removes one",
  evaluate: reconcileFact,
  generate: reconcileFact,
  id: "memory-reconcile",
  name: "Memory Reconcile",
  score: scoreMemoryReconcile,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
