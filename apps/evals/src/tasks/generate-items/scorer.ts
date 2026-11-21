import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
} from "@zoonk/ai/tasks/items/schemas";
import { checkItem, findOwnEmDashes } from "@zoonk/core/library/items/checks";
import { toCheckedItem } from "@zoonk/core/library/items/create";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "./score-categories";
import { type GenerateItemsExpected } from "./test-cases";

type GenerateItemsCase = {
  examFormat?: {
    entry?: NumericEntry | null;
    optionCount?: number | null;
    select?: OptionSelect | null;
  } | null;
  format: ItemFormat;
  language: string;
  targetLanguage?: string | null;
};

function blockedItems(items: GeneratedItem[], input: GenerateItemsCase) {
  const checked = items.map((item, index) =>
    toCheckedItem({
      answerFormat: {
        entry: input.examFormat?.entry ?? undefined,
        select: input.examFormat?.select ?? undefined,
      },
      format: input.format,
      index,
      item,
      language: input.language,
      optionCount: input.examFormat?.optionCount ?? null,
      optionLanguage: input.targetLanguage,
    }),
  );

  return checked.every((item) => item.problems.length > 0)
    ? checked.flatMap(({ index, problems }) =>
        problems.map((problem) => `Item ${index + 1}: ${problem}`),
      )
    : [];
}

export const checkGeneratedItems: TaskCodeChecks<GenerateItemsExpected> = ({
  output,
  testCase,
}) => {
  const input = testCase.userInput as GenerateItemsCase;
  const { items } = JSON.parse(output) as { items: GeneratedItem[] };

  if (items.length === 0) {
    const emptyExpected = testCase.expected?.empty === true;
    const problems = emptyExpected ? [] : ["The output has no items to save."];

    return {
      blockingProblems: problems,
      judgedOutput: output,
      keyFlawLocators: [],
      passed: Number(emptyExpected),
      problems,
      total: 1,
    };
  }

  const checked = items.map((item, index) => ({
    item,
    itemLocator: `items[${index}]`,
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
    blockingProblems: blockedItems(items, input),
    judgedOutput: JSON.stringify(
      { items: passing.map(({ item, itemLocator }) => ({ ...item, itemLocator })) },
      null,
      2,
    ),
    keyFlawLocators: passing.map((entry) => entry.itemLocator),
    passed: passing.length,
    problems: checked.flatMap((entry) => entry.problems),
    total: items.length,
  };
};

export const scoreGeneratedItems: TaskScorer<GenerateItemsExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkGeneratedItems({ output: value, testCase }),
    output,
    scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
    testCase,
  });
