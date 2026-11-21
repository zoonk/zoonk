import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type WriteItemSetParams,
  type WrittenItemSet,
  toSetItem,
} from "@zoonk/ai/tasks/items/write-set";
import { toCheckedItem } from "@zoonk/core/library/items/create";
import {
  MIN_SET_QUESTIONS,
  checkWrittenItemSet,
  repairWrittenItemSet,
} from "@zoonk/core/library/items/set-checks";
import { WRITE_ITEM_SET_SCORE_CATEGORIES } from "./score-categories";

type WriteItemSetCase = Pick<
  WriteItemSetParams,
  "examFormat" | "format" | "language" | "skills" | "targetLanguage"
>;

const SET_CHECKS = 1;

export const checkWriteItemSetOutput: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as WriteItemSetCase;
  const set = repairWrittenItemSet(JSON.parse(output) as WrittenItemSet);
  const check = checkWrittenItemSet({ set, skillCount: input.skills.length });

  const optionCount =
    input.format === "multipleChoice" ? (input.examFormat?.optionCount ?? null) : null;

  const checked = set.questions.map((question, index) => {
    const { problems } = toCheckedItem({
      answerFormat: {},
      format: input.format,
      index,
      item: toSetItem(question),
      language: input.language,
      optionCount,
      optionLanguage: input.targetLanguage,
    });

    return {
      itemLocator: `questions[${index}]`,
      problems: [...(check.questions[index] ?? []), ...problems].map(
        (problem) => `Question ${index + 1}: ${problem}`,
      ),
      question,
    };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    blockingProblems: [
      ...check.set,
      ...(passing.length < MIN_SET_QUESTIONS
        ? [`Fewer than ${MIN_SET_QUESTIONS} questions passed the set checks.`]
        : []),
    ],
    judgedOutput: JSON.stringify(
      {
        ...set,
        questions: passing.map(({ question, itemLocator }) => ({ ...question, itemLocator })),
      },
      null,
      2,
    ),
    keyFlawLocators: passing.map((entry) => entry.itemLocator),
    passed: passing.length === 0 ? 0 : passing.length + (check.set.length === 0 ? SET_CHECKS : 0),
    problems: [...check.set, ...checked.flatMap((entry) => entry.problems)],
    total: checked.length + SET_CHECKS,
  };
};

export const scoreWriteItemSet: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkWriteItemSetOutput({ output: value, testCase }),
    output,
    scoreCategories: WRITE_ITEM_SET_SCORE_CATEGORIES,
    testCase,
  });
