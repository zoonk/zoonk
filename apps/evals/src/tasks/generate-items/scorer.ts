import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type GeneratedItem, type ItemFormat } from "@zoonk/ai/tasks/v2/items/schemas";
import { checkItem } from "@zoonk/core/library/items/checks";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "./score-categories";

type GenerateItemsCase = {
  examFormat?: { optionCount?: number | null } | null;
  format: ItemFormat;
};

/** Runs the same checks production runs before storing items, then keeps only passing items. */
function checkGeneratedItems(output: string, input: GenerateItemsCase): CodeCheckResult {
  const { items } = JSON.parse(output) as { items: GeneratedItem[] };

  const checked = items.map((item, index) => ({
    item,
    problems: checkItem({
      expectedFormat: input.format,
      item,
      optionCount: input.examFormat?.optionCount ?? null,
    }).map((problem) => `Item ${index + 1}: ${problem}`),
  }));

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    judgedOutput: JSON.stringify({ items: passing.map((entry) => entry.item) }, null, 2),
    passed: passing.length,
    problems: checked.flatMap((entry) => entry.problems),
    total: items.length,
  };
}

export const scoreGeneratedItems: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkGeneratedItems(value, testCase.userInput as GenerateItemsCase),
    output,
    scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
    testCase,
  });
