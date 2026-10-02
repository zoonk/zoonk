import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type Task } from "@/lib/types";
import {
  type ChallengeCaseParams,
  type WrittenChallengeCase,
  generateChallengeCase,
} from "@zoonk/ai/tasks/v2/challenge/case";
import { checkWrittenChallenge } from "@zoonk/core/library/challenges/case-content";
import { CHALLENGE_CASE_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

/**
 * A case ships whole or not at all: code checks it against the challenge step contract (every id
 * it points at, 2 to 4 decisions on every path, no loops, a strong choice and another at every
 * decision, each skill trained), exactly as publishing does.
 */
function checkOutput(output: string, variant: ChallengeCaseParams["variant"]): CodeCheckResult {
  const written = JSON.parse(output) as WrittenChallengeCase;
  const { problems } = checkWrittenChallenge({ variant, written });

  return { judgedOutput: output, passed: problems.length === 0 ? 1 : 0, problems, total: 1 };
}

export const challengeCaseTask: Task<ChallengeCaseParams, WrittenChallengeCase> = {
  description:
    "Write the challenge that closes a chapter: a work case with a team and decisions that change the state, or a light What if for overview courses. Code checks the decision graph, then a judge",
  generate: generateChallengeCase,
  id: "challenge-case",
  name: "Challenge Case",
  score: ({ output, testCase }) =>
    scoreWithCodeChecks({
      check: (text) => checkOutput(text, (testCase.userInput as ChallengeCaseParams).variant),
      output,
      scoreCategories: CHALLENGE_CASE_SCORE_CATEGORIES,
      testCase,
    }),
  scoreCategories: CHALLENGE_CASE_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
