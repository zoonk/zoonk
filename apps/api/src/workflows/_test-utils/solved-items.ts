import {
  type ItemSolution,
  type SolvableItem,
  type SolveItemsParams,
} from "@zoonk/ai/tasks/items/solve";
import { taskResult } from "./recorded-outputs";

export function solveAsKeyed(item: SolvableItem): ItemSolution {
  if (item.format === "trueFalse") {
    return { format: "trueFalse", isTrue: item.isTrue, work: "Reaches the key." };
  }

  const picks = item.options.flatMap((option, index) => (option.isCorrect ? [index] : []));
  return { format: "multipleChoice", picks, work: "Reaches the key." };
}

/** A solver that reaches every key, as it does for a writer that got them right. */
export async function solveLikeTheKeys({ items }: SolveItemsParams) {
  return taskResult({ solutions: items.map((item) => solveAsKeyed(item)) });
}
