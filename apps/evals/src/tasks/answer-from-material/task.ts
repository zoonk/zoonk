import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type AnswerFromMaterialInput,
  type MaterialAnswer,
  answerFromMaterial,
} from "@zoonk/ai/tasks/material/answer";
import { findBareLatexText } from "@zoonk/utils/bare-latex";
import { findMathSpans } from "@zoonk/utils/math-spans";
import { normalizeString } from "@zoonk/utils/string";
import { type AnswerFromMaterialExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

const LATEX_COMMAND = /\\[A-Za-z]+/u;

/**
 * The answer views print plain text, so math markup reaches the learner as typed: delimiters, a
 * command (`\frac`) or a script written with `^` or `_` (`x^2`, `v_m`).
 */
function hasMathMarkup(text: string): boolean {
  return (
    LATEX_COMMAND.test(text) ||
    text.split("\n").some((line) => findMathSpans(line).length > 0) ||
    findBareLatexText({ layout: "blocks", text }).length > 0
  );
}

function parseOutput(output: string): MaterialAnswer | null {
  try {
    return JSON.parse(output) as MaterialAnswer;
  } catch {
    return null;
  }
}

function listChecks({
  answer,
  expected,
}: {
  answer: MaterialAnswer;
  expected: AnswerFromMaterialExpected;
}) {
  const text = normalizeString(answer.answer);

  return [
    { label: "found", passed: answer.found === expected.found },
    {
      label: "pages",
      passed: expected.found
        ? answer.refs.some((ref) => expected.refs.includes(ref))
        : answer.refs.length === 0,
    },
    { label: "plain math", passed: !hasMathMarkup(answer.answer) },
    ...expected.mentions.map((options) => ({
      label: `mentions ${options[0]}`,
      passed: options.some((option) => text.includes(normalizeString(option))),
    })),
  ];
}

const scoreAnswer: TaskScorer<AnswerFromMaterialExpected> = ({ output, testCase }) => {
  const answer = parseOutput(output);

  if (!answer || !testCase.expected) {
    return createFixedScore({ conclusion: "No answer", score: MIN_SCORE });
  }

  const checks = listChecks({ answer, expected: testCase.expected });
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length,
  });
};

export const answerFromMaterialTask: Task<
  AnswerFromMaterialInput,
  MaterialAnswer,
  AnswerFromMaterialExpected
> = {
  description: "Answer a question from the learner's own material, citing its pages",
  generate: answerFromMaterial,
  id: "answer-from-material",
  name: "Answer from material",
  priorities: {
    distribution: "private",
    first: "cost",
    reads: "A learner reads the answer, with citations from their material",
    reason: "One learner's own material: the cheapest model that answers right",
    waits: "A learner waits in the request",
  },
  score: scoreAnswer,
  testCases: TEST_CASES,
};
