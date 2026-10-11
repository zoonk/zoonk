import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { checkItem, findOwnEmDashes } from "@zoonk/core/library/items/checks";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "./score-categories";

type GenerateItemsCase = {
  examFormat?: {
    entry?: NumericEntry | null;
    optionCount?: number | null;
    select?: OptionSelect | null;
  } | null;
  format: ItemFormat;
  language: string;
};

/**
 * Runs the same checks production runs before storing items, and finds the em dashes storing them
 * takes out of our own wording, then keeps only passing items.
 */
function checkGeneratedItems(output: string, input: GenerateItemsCase): CodeCheckResult {
  const { items } = JSON.parse(output) as { items: GeneratedItem[] };

  // No items is the writer's answer for a skill the format doesn't fit (a number for a reading
  // skill): code has nothing to check, and the judge says whether none was right.
  if (items.length === 0) {
    return { judgedOutput: output, passed: 1, problems: [], total: 1 };
  }

  const checked = items.map((item, index) => ({
    item,
    problems: [
      ...checkItem({
        expectedFormat: input.format,
        item,
        language: input.language,
        optionCount: input.examFormat?.optionCount ?? null,
        ...(input.examFormat?.entry ? { entry: input.examFormat.entry } : {}),
        ...(input.examFormat?.select ? { select: input.examFormat.select } : {}),
      }),
      ...findOwnEmDashes(item),
    ].map((problem) => `Item ${index + 1}: ${problem}`),
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
