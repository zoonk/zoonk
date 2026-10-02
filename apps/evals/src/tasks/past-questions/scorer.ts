import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type ExtractPastQuestionsParams,
  type PastQuestion,
} from "@zoonk/ai/tasks/v2/items/past-questions";
import { checkItem } from "@zoonk/core/library/items/checks";
import { checkPastQuestion } from "@zoonk/core/library/items/past-question-checks";
import { PAST_QUESTIONS_SCORE_CATEGORIES } from "./score-categories";

/** The checks production runs before storing a quoted question: the item's own and the quote's. */
function checkQuestions(output: string, input: ExtractPastQuestionsParams): CodeCheckResult {
  const { questions } = JSON.parse(output) as { questions: PastQuestion[] };

  const checked = questions.map((question) => ({
    problems: [
      ...checkItem({
        expectedFormat: input.format,
        item: question.item,
        optionCount: input.optionCount ?? null,
      }),
      ...checkPastQuestion({
        paperText: input.paper.text,
        question,
        skillCount: input.skills.length,
      }),
    ].map((problem) => `Question ${question.number}: ${problem}`),
    question,
  }));

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    judgedOutput: JSON.stringify({ questions: passing.map((entry) => entry.question) }, null, 2),
    passed: passing.length,
    problems: checked.flatMap((entry) => entry.problems),
    total: Math.max(questions.length, 1),
  };
}

export const scorePastQuestions: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkQuestions(value, testCase.userInput as ExtractPastQuestionsParams),
    output,
    scoreCategories: PAST_QUESTIONS_SCORE_CATEGORIES,
    testCase,
  });
