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

/** The set-level part of the checks: the script, the count and the evidence of every question. */
const SET_CHECKS = 1;

/**
 * The pipeline's checks, as production runs them before storing: the set's own problems
 * (`findListeningSetProblems`, the same list the task drafts again on) and each question's item
 * checks after code repaired what it can (`repairItem`). The judge sees the set with only the
 * questions that pass.
 */
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
