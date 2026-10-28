import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { findListeningSetProblems } from "@zoonk/ai/tasks/v2/listening/checks";
import { toListeningItem } from "@zoonk/ai/tasks/v2/listening/schema";
import {
  type WriteListeningSetParams,
  type writeListeningSet,
} from "@zoonk/ai/tasks/v2/listening/write-set";
import { checkItem } from "@zoonk/core/library/items/checks";
import { repairItem } from "@zoonk/core/library/items/repairs";
import { WRITE_LISTENING_SET_SCORE_CATEGORIES } from "./score-categories";

type WriteListeningSetOutput = Awaited<ReturnType<typeof writeListeningSet>>["data"];

type WriteListeningSetCase = Pick<
  WriteListeningSetParams,
  "count" | "formats" | "language" | "optionCount" | "scriptLanguage" | "skills"
>;

const SET_CHECKS = 1;

function checkWriteListeningSetOutput(
  output: string,
  input: WriteListeningSetCase,
): CodeCheckResult {
  const { set } = JSON.parse(output) as WriteListeningSetOutput;

  const request = {
    count: input.count,
    formats: input.formats,
    optionCount: input.optionCount ?? null,
    skillCount: input.skills.length,
  };

  const setProblems = findListeningSetProblems(set, request);

  const checked = set.questions.map((question) => {
    const optionCount = question.format === "multipleChoice" ? (input.optionCount ?? null) : null;
    const language = input.scriptLanguage;
    const item = repairItem({ item: toListeningItem(question), language, optionCount });

    return { problems: checkItem({ item, language, optionCount }), question };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    judgedOutput: JSON.stringify(
      { ...set, questions: passing.map((entry) => entry.question) },
      null,
      2,
    ),
    passed: passing.length + (setProblems.length === 0 ? SET_CHECKS : 0),
    problems: [...setProblems, ...checked.flatMap((entry) => entry.problems)],
    total: checked.length + SET_CHECKS,
  };
}

export const scoreWriteListeningSet: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) =>
      checkWriteListeningSetOutput(value, testCase.userInput as WriteListeningSetCase),
    output,
    scoreCategories: WRITE_LISTENING_SET_SCORE_CATEGORIES,
    testCase,
  });
