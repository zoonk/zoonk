import { type ItemSolution, type SolvableItem } from "@zoonk/ai/tasks/items/solve";

function quoteOptions(item: Extract<SolvableItem, { format: "multipleChoice" }>, picks: number[]) {
  return picks.map((index) => `"${item.options[index]?.text ?? "?"}"`).join(", ");
}

function findChoiceMismatch(
  item: Extract<SolvableItem, { format: "multipleChoice" }>,
  { picks, work }: Extract<ItemSolution, { format: "multipleChoice" }>,
): string | null {
  const keyed = item.options.flatMap((option, index) => (option.isCorrect ? [index] : []));
  const same = picks.length === keyed.length && keyed.every((index) => picks.includes(index));

  if (same) {
    return null;
  }

  if (picks.length === 0) {
    return `The solver found no right option: ${work}`;
  }

  return `Keyed ${quoteOptions(item, keyed)}, but the solver picked ${quoteOptions(item, picks)}: ${work}`;
}

function findStatementMismatch(
  item: Extract<SolvableItem, { format: "trueFalse" }>,
  { isTrue, work }: Extract<ItemSolution, { format: "trueFalse" }>,
): string | null {
  if (isTrue === item.isTrue) {
    return null;
  }

  if (isTrue === null) {
    return `The solver couldn't judge the statement: ${work}`;
  }

  return `Keyed ${item.isTrue}, but the solver judged it ${isTrue}: ${work}`;
}

/** Null when a blind solve reached the item's key; otherwise why the key can't be trusted. */
export function findKeyMismatch({
  item,
  solution,
}: {
  item: SolvableItem;
  solution: ItemSolution | null;
}): string | null {
  if (item.format === "multipleChoice" && solution?.format === "multipleChoice") {
    return findChoiceMismatch(item, solution);
  }

  if (item.format === "trueFalse" && solution?.format === "trueFalse") {
    return findStatementMismatch(item, solution);
  }

  return "The solver gave no answer.";
}
