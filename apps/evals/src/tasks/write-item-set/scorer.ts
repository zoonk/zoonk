import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type WriteItemSetParams,
  type WrittenItemSet,
  toSetItem,
} from "@zoonk/ai/tasks/v2/items/write-set";
import { checkItem } from "@zoonk/core/library/items/checks";
import { repairItem } from "@zoonk/core/library/items/repairs";
import { checkWrittenItemSet, repairWrittenItemSet } from "@zoonk/core/library/items/set-checks";
import { WRITE_ITEM_SET_SCORE_CATEGORIES } from "./score-categories";

type WriteItemSetCase = Pick<WriteItemSetParams, "examFormat" | "format" | "language" | "skills">;

const SET_CHECKS = 1;

function checkWriteItemSetOutput(output: string, input: WriteItemSetCase): CodeCheckResult {
  const set = repairWrittenItemSet(JSON.parse(output) as WrittenItemSet);
  const check = checkWrittenItemSet({ set, skillCount: input.skills.length });

  const optionCount =
    input.format === "multipleChoice" ? (input.examFormat?.optionCount ?? null) : null;

  const checked = set.questions.map((question, index) => {
    const item = repairItem({ item: toSetItem(question), language: input.language, optionCount });

    return {
      problems: [
        ...(check.questions[index] ?? []),
        ...checkItem({ item, language: input.language, optionCount }),
      ].map((problem) => `Question ${index + 1}: ${problem}`),
      question,
    };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    judgedOutput: JSON.stringify(
      { ...set, questions: passing.map((entry) => entry.question) },
      null,
      2,
    ),
    passed: passing.length + (check.set.length === 0 ? SET_CHECKS : 0),
    problems: [...check.set, ...checked.flatMap((entry) => entry.problems)],
    total: checked.length + SET_CHECKS,
  };
}

export const scoreWriteItemSet: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkWriteItemSetOutput(value, testCase.userInput as WriteItemSetCase),
    output,
    scoreCategories: WRITE_ITEM_SET_SCORE_CATEGORIES,
    testCase,
  });
