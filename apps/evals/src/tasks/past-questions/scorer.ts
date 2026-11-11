import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type ExtractPastQuestionsParams,
  type PastQuestion,
} from "@zoonk/ai/tasks/items/past-questions";
import { checkPastQuestion } from "@zoonk/core/library/items/past-question-checks";
import { PAST_QUESTIONS_SCORE_CATEGORIES } from "./score-categories";

function checkQuestions(output: string, input: ExtractPastQuestionsParams): CodeCheckResult {
  const { questions } = JSON.parse(output) as { questions: PastQuestion[] };

  const checked = questions.map((written, index) => {
    const { problems, question } = checkPastQuestion({
      paperText: input.paper.text,
      question: written,
      target: {
        format: input.format,
        language: input.language,
        optionCount: input.optionCount ?? null,
        skillCount: input.skills.length,
      },
    });

    return {
      itemLocator: `questions[${index}].item (question ${question.number})`,
      problems: problems.map((problem) => `Question ${question.number}: ${problem}`),
      question,
    };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    judgedOutput: JSON.stringify(
      { questions: passing.map(({ question, itemLocator }) => ({ ...question, itemLocator })) },
      null,
      2,
    ),
    keyFlawLocators: passing.map((entry) => entry.itemLocator),
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
