import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type LevelTestQuestionCheck,
  checkLevelTestQuestions,
  findLevelTestQuestionProblem,
} from "@zoonk/ai/tasks/language/check-level-test-questions";
import {
  type CheckLevelTestQuestionsExpected,
  type CheckLevelTestQuestionsInput,
  TEST_CASES,
} from "./test-cases";

type CheckLevelTestQuestionsOutput = { checks: (LevelTestQuestionCheck | null)[] };

const MISSED_FLAW_SCORE = 6;
const PASSING_FLOOR = 8;
const KEPT_RIGHT_POINTS = 2;

/**
 * A missed flaw reaches every learner of the pair, so a checker that misses one fails; past that
 * bar, the score rises with the share of good questions kept.
 */
function toScore({ keptRate, missed }: { keptRate: number; missed: number }): number {
  return missed > 0 ? MISSED_FLAW_SCORE : PASSING_FLOOR + KEPT_RIGHT_POINTS * keptRate;
}

const scoreCheckLevelTestQuestions: TaskScorer<CheckLevelTestQuestionsExpected> = ({
  output,
  testCase,
}) => {
  const { expected } = testCase;
  const { questions } = testCase.userInput as CheckLevelTestQuestionsInput;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { checks } = JSON.parse(output) as CheckLevelTestQuestionsOutput;

  const verdicts = questions.map((question, index) => ({
    number: index + 1,
    reason: findLevelTestQuestionProblem({ check: checks[index] ?? null, question }),
  }));

  const missed = verdicts.filter(({ number, reason }) => expected.drop.includes(number) && !reason);

  const good = verdicts.filter(
    ({ number }) => !expected.drop.includes(number) && !expected.either.includes(number),
  );

  const falseDrops = good.filter(({ reason }) => reason);
  const keptRate = good.length === 0 ? 1 : (good.length - falseDrops.length) / good.length;

  const conclusion = [
    `Caught ${expected.drop.length - missed.length} of ${expected.drop.length} flawed questions; kept ${good.length - falseDrops.length} of ${good.length} good ones.`,
    ...missed.map(({ number }) => `Missed the flaw in question ${number}.`),
    ...falseDrops.map(({ number, reason }) => `Dropped good question ${number}: ${reason}`),
  ].join(" ");

  return createFixedScore({ conclusion, score: toScore({ keptRate, missed: missed.length }) });
};

export const checkLevelTestQuestionsTask: Task<
  CheckLevelTestQuestionsInput,
  CheckLevelTestQuestionsOutput,
  CheckLevelTestQuestionsExpected
> = {
  description:
    "Answer a language placement test's questions without their keys and say how each is answered, so code drops wrong or ambiguous keys, answers a non-reader could pick, questions not in the learner's language and B2 or C1 questions a face-value reading answers, and keeps good questions",
  generate: checkLevelTestQuestions,
  id: "check-level-test-questions",
  name: "Check Level Test Questions",
  score: scoreCheckLevelTestQuestions,
  testCases: TEST_CASES,
};
