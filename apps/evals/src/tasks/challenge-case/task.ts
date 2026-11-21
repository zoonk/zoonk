import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task, type TaskCodeChecks } from "@/lib/types";
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
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
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
    initialPrompt: { systemPrompt: plan.systemPrompt, userPrompt: plan.userPrompt },
    systemPrompt: `${plan.systemPrompt}\n\n${script.systemPrompt}`,
    usage: sumLanguageModelUsage([plan.usage, script.usage]),
    userPrompt: `${plan.userPrompt}\n---\n${script.userPrompt}`,
  };
}

const checkOutput: TaskCodeChecks = ({ output, testCase }) => {
  const { variant } = testCase.userInput as ChallengeCaseParams;
  const written = JSON.parse(output) as WrittenChallengeCase;
  const { problems } = checkWrittenChallenge({ variant, written });

  return {
    blockingProblems: problems,
    criteria: ["decisions"],
    judgedOutput: output,
    passed: problems.length === 0 ? 1 : 0,
    problems,
    total: 1,
  };
};

export const challengeCaseTask: Task<OptionalCountry<ChallengeCaseParams>, WrittenChallengeCase> = {
  codeChecks: checkOutput,
  criteria: readCriteria(CHALLENGE_CASE_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Write the challenge that closes a chapter: a work case with a team and decisions that change the state, or a light What if for overview courses. Code checks the decision graph, then a judge",
  generate: (input) => generateFirstChallengeDraft({ ...input, country: input.country ?? null }),
  id: "challenge-case",
  name: "Challenge case",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        debrief: "counts",
        decisions: "counts",
        depth: "counts",
        plainLanguage: "counts",
        realism: "counts",
        team: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner plays the case and reads its debrief",
    reason: "Shared cases are reused across learners, and the case is the lesson's practice",
    waits: "Set by the lesson's wait: a learner, soon or later",
  },
  score: ({ output, testCase }) =>
    scoreWithCodeChecks({
      check: (value) => checkOutput({ output: value, testCase }),
      output,
      scoreCategories: CHALLENGE_CASE_SCORE_CATEGORIES,
      testCase,
    }),
  scoreCategories: CHALLENGE_CASE_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
