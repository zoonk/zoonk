import { cn } from "@zoonk/ui/lib/utils";
import { Output, generateText } from "ai";
import { calculateScore } from "./score-calculation";
import { formatScoreCategories, resolveCategoryScores } from "./score-categories";
import systemPrompt from "./system-prompt.md";
import {
  type JudgeRun,
  type ScoreCategory,
  type ScoreStep,
  categorizedScoreSchema,
  scoreSchema,
  toTokenUsage,
} from "./types";

/**
 * Scoring mode keeps one judge so scores stay comparable across runs. Battle
 * mode is where several judges from other model families compare outputs.
 */
const SCORING_JUDGE_MODEL_ID = "openai/gpt-6-astra";

const BAD_SCORE = 8;
const GOOD_SCORE = 9.2;
const SCORE_STEP_KINDS = ["majorErrors", "minorErrors", "potentialImprovements"] as const;

/**
 * Builds deterministic score steps for extractor-style tasks where one exact
 * pass/fail score should apply to the whole output. This avoids judge-model
 * drift where the same classification error receives different scores in the
 * major, minor, and improvement buckets.
 */
export function createFixedScore({ conclusion, score }: { conclusion: string; score: number }) {
  const steps: ScoreStep[] = SCORE_STEP_KINDS.map((kind) => ({ conclusion, kind, score }));

  return { score, steps };
}

/**
 * This function analyzes the output of a given task and run against the
 * test-case expectations plus the concrete input values. The production
 * system prompt is intentionally excluded so a bad prompt cannot become part
 * of the grading rubric.
 *
 * It returns a list of steps with conclusions and scores, an overall score
 * which is the average of all step scores, and the judge's usage for cost.
 */
export async function generateScore(params: {
  expectations: string;
  prompt: string;
  output: string;
  scoreCategories?: ScoreCategory[];
}) {
  const { expectations, prompt, output, scoreCategories } = params;

  const categoriesSection = scoreCategories
    ? `
    **Score categories**
    Score every category independently. A strength in one category must not erase a weakness in another.

    ${formatScoreCategories(scoreCategories)}
    `
    : "";

  const evalPrompt = `
    **Expectations**
    ${expectations}

    ${categoriesSection}

    **User provided values**
    ${prompt}

    **Result**
    ${output}
  `;

  if (scoreCategories) {
    const { output: result, usage } = await generateText({
      instructions: systemPrompt,
      model: SCORING_JUDGE_MODEL_ID,
      output: Output.object({ schema: categorizedScoreSchema }),
      prompt: evalPrompt,
    });

    const categoryScores = resolveCategoryScores({
      categories: scoreCategories,
      judgeScores: result.categoryScores,
    });

    return {
      categoryScores,
      judge: getJudgeRun(usage),
      score: calculateScore({ categoryScores, steps: result.steps }),
      steps: result.steps,
    };
  }

  const { output: result, usage } = await generateText({
    instructions: systemPrompt,
    model: SCORING_JUDGE_MODEL_ID,
    output: Output.object({ schema: scoreSchema }),
    prompt: evalPrompt,
  });

  return {
    judge: getJudgeRun(usage),
    score: calculateScore({ steps: result.steps }),
    steps: result.steps,
  };
}

function getJudgeRun(usage: Parameters<typeof toTokenUsage>[0]): JudgeRun {
  return { modelId: SCORING_JUDGE_MODEL_ID, usage: toTokenUsage(usage) };
}

export const getScoreClassName = (score: number) => {
  const isBadScore = score < BAD_SCORE;
  const isAverageScore = score >= BAD_SCORE && score < GOOD_SCORE;
  const isGoodScore = score >= GOOD_SCORE;

  return cn({
    "text-destructive": isBadScore,
    "text-success": isGoodScore,
    "text-warning": isAverageScore,
  });
};
