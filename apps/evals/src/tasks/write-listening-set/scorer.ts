import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { findListeningSetProblems } from "@zoonk/ai/tasks/listening/checks";
import { toListeningItem } from "@zoonk/ai/tasks/listening/schema";
import {
  type WriteListeningSetParams,
  type writeListeningSet,
} from "@zoonk/ai/tasks/listening/write-set";
import { toCheckedItem } from "@zoonk/core/library/items/checks";
import { WRITE_LISTENING_SET_SCORE_CATEGORIES } from "./score-categories";

type WriteListeningSetOutput = Awaited<ReturnType<typeof writeListeningSet>>["data"];

type WriteListeningSetCase = Pick<
  WriteListeningSetParams,
  "count" | "formats" | "language" | "optionCount" | "scriptLanguage" | "skills"
>;

const SET_CHECKS = 1;

export const checkWriteListeningSetOutput: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as WriteListeningSetCase;
  const { problems: blockingProblems, set } = JSON.parse(output) as WriteListeningSetOutput;

  const request = {
    count: input.count,
    formats: input.formats,
    optionCount: input.optionCount ?? null,
    skillCount: input.skills.length,
  };

  const setProblems = findListeningSetProblems(set, request);

  const checked = set.questions.map((question, index) => {
    const optionCount = question.format === "multipleChoice" ? (input.optionCount ?? null) : null;

    const { item, problems } = toCheckedItem({
      answerFormat: {},
      format: question.format,
      index,
      item: toListeningItem(question),
      language: input.language,
      optionCount,
      optionLanguage: input.scriptLanguage,
    });

    return {
      itemLocator: `set.questions[${index}]`,
      problems,
      question:
        item.format === "typed"
          ? { ...question, acceptedAnswers: item.acceptedAnswers, sampleAnswer: item.sampleAnswer }
          : question,
    };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    blockingProblems: [
      ...blockingProblems,
      ...(passing.length === 0 ? ["No listening question passed the save checks."] : []),
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
    passed: passing.length === 0 ? 0 : passing.length + (setProblems.length === 0 ? SET_CHECKS : 0),
    problems: [...setProblems, ...checked.flatMap((entry) => entry.problems)],
    total: checked.length + SET_CHECKS,
  };
};

export const scoreWriteListeningSet: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkWriteListeningSetOutput({ output: value, testCase }),
    output,
    scoreCategories: WRITE_LISTENING_SET_SCORE_CATEGORIES,
    testCase,
  });
