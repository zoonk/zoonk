import "server-only";
import { classify } from "../../../evaluate/classify";
import { type EvaluationRunDetails } from "../../../evaluate/evaluate-questions";
import {
  type MemoryFactIntent,
  type MemoryReconcileAction,
  decideMemoryReconcile,
  getMemoryReconcileLabels,
} from "./memory-decisions";
import { type MemoryFactText, formatMemoryFact, formatMemoryFactList } from "./memory-facts";
import instructions from "./memory-reconcile.prompt.md";

/** The memory-reconcile eval's runner-up. */
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";

export type MemoryReconcileInput = {
  fact: MemoryFactText & { intent: MemoryFactIntent };
  /** In the order the labels number them. */
  existing: readonly MemoryFactText[];
};

/** Its labels depend on how many related facts there are, so the eval builds them the same way. */
export const memoryReconcileClassifier = {
  getLabels: ({ existing }: MemoryReconcileInput) => getMemoryReconcileLabels(existing.length),
  instructions,
  toInput: ({ existing, fact }: MemoryReconcileInput) => ({
    EXISTING_FACTS: formatMemoryFactList(existing),
    NEW_FACT: `${formatMemoryFact(fact)} (${fact.intent})`,
  }),
};

type MemoryReconcileRun = EvaluationRunDetails & {
  decision: MemoryReconcileAction;
  choice: string;
  probabilities?: Readonly<Record<string, number>>;
};

/**
 * "Wants Law" replaces "Wants Medicine" instead of sitting next to it. With no related facts there
 * is nothing to compare, so no model is called.
 */
export async function reconcileMemoryFact(
  input: MemoryReconcileInput,
): Promise<MemoryReconcileRun | null> {
  if (input.existing.length === 0) {
    return null;
  }

  const result = await classify({
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: memoryReconcileClassifier.toInput(input),
    instructions: memoryReconcileClassifier.instructions,
    labels: memoryReconcileClassifier.getLabels(input),
    task: "memory-reconcile",
  });

  const decision = decideMemoryReconcile({
    choice: result.choice,
    existingCount: input.existing.length,
    intent: input.fact.intent,
    probabilities: result.probabilities,
  });

  return { ...result, decision };
}
