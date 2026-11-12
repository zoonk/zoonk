import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type Task } from "@/lib/types";
import { sumLanguageModelUsage } from "@zoonk/ai/combine-task-provenance";
import { assembleChallengeCase } from "@zoonk/ai/tasks/challenge/assemble";
import { generateChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import {
  type ChallengeCaseParams,
  type WrittenChallengeCase,
} from "@zoonk/ai/tasks/challenge/schema";
import { generateChallengeScript } from "@zoonk/ai/tasks/challenge/script";
import { checkWrittenChallenge } from "@zoonk/core/library/challenges/case-content";
import { checkChallengePlan } from "@zoonk/core/library/challenges/plan-check";
import { CHALLENGE_CASE_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

async function generateFirstChallengeDraft(params: ChallengeCaseParams) {
  const plan = await generateChallengePlan(params);

  const problems = checkChallengePlan({
    plan: plan.data,
    skills: params.skills,
    variant: params.variant,
  });

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }

  const script = await generateChallengeScript({ ...params, plan: plan.data });
  const { written, missing } = assembleChallengeCase({ plan: plan.data, script: script.data });

  if (missing.length > 0) {
    throw new Error(`The script left out ${missing.join(", ")}`);
  }

  return {
    data: written,
    systemPrompt: `${plan.systemPrompt}\n\n${script.systemPrompt}`,
    usage: sumLanguageModelUsage([plan.usage, script.usage]),
    userPrompt: `${plan.userPrompt}\n---\n${script.userPrompt}`,
  };
}

function checkOutput(output: string, variant: ChallengeCaseParams["variant"]): CodeCheckResult {
  const written = JSON.parse(output) as WrittenChallengeCase;
  const { problems } = checkWrittenChallenge({ variant, written });

  return { judgedOutput: output, passed: problems.length === 0 ? 1 : 0, problems, total: 1 };
}

export const challengeCaseTask: Task<ChallengeCaseParams, WrittenChallengeCase> = {
  description:
    "Write the challenge that closes a chapter: a work case with a team and decisions that change the state, or a light What if for overview courses. Code checks the decision graph, then a judge",
  generate: generateFirstChallengeDraft,
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
