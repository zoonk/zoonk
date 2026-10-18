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

/** The runner-up from the memory-reconcile eval, used when Jev errors, times out or can't fit the input. */
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";

export type MemoryReconcileInput = {
  fact: MemoryFactText & { intent: MemoryFactIntent };
  /** Related facts memory holds, in the order the labels number them. */
  existing: readonly MemoryFactText[];
};

/**
 * The reconcile question for any evaluation model. Its labels depend on how many related facts
 * there are, so the eval and production build them the same way from the input.
 */
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
 * Decides whether a new fact is added, ignored as a duplicate, replaces an existing fact or
 * removes one: "Wants Law" replaces "Wants Medicine" instead of sitting next to it. With no
 * related facts there is nothing to compare, so no model is called.
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
