import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { NoOutputGeneratedError, Output, generateText } from "ai";
import z from "zod";
import { normalizeAnonymousId } from "./battle-mapping";
import battleSystemPrompt from "./battle-system-prompt.md";
import { calculateScore } from "./score-calculation";
import { formatScoreCategories, resolveCategoryScores } from "./score-categories";
import {
  type ModelRanking,
  type ScoreCategory,
  type TokenUsage,
  judgeCategoryScoreSchema,
  toTokenUsage,
} from "./types";

const MAX_BATTLE_RANKING_ATTEMPTS = 3;

const modelRankingSchema = z.object({
  anonymousId: z.string(),
  reasoning: z.string(),
  score: z.number().min(1).max(10),
});

const battleRankingSchema = z.object({ rankings: z.array(modelRankingSchema) });

const categorizedModelRankingSchema = modelRankingSchema
  .omit({ score: true })
  .extend({ categoryScores: z.array(judgeCategoryScoreSchema) });

const categorizedBattleRankingSchema = z.object({
  rankings: z.array(categorizedModelRankingSchema),
});

type BattleRankingResult =
  | z.infer<typeof battleRankingSchema>
  | z.infer<typeof categorizedBattleRankingSchema>;

type BattleRankingGeneration = { result: BattleRankingResult; usage: TokenUsage };

function addUsage(first: TokenUsage, second: TokenUsage): TokenUsage {
  return {
    cacheReadTokens: (first.cacheReadTokens ?? 0) + (second.cacheReadTokens ?? 0),
    cacheWriteTokens: (first.cacheWriteTokens ?? 0) + (second.cacheWriteTokens ?? 0),
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    reasoningTokens: (first.reasoningTokens ?? 0) + (second.reasoningTokens ?? 0),
  };
}

function getModelMapping({
  anonymousId,
  judgeId,
  mapping,
}: {
  anonymousId: string;
  judgeId: string;
  mapping: { anonymousId: string; modelId: string }[];
}): { anonymousId: string; modelId: string } {
  const normalizedAnonymousId = normalizeAnonymousId(anonymousId);

  const modelMapping = mapping.find(
    (entry) => normalizeAnonymousId(entry.anonymousId) === normalizedAnonymousId,
  );

  if (!modelMapping) {
    throw new Error(`Battle judge ${judgeId} returned an unknown anonymous label: ${anonymousId}.`);
  }

  return modelMapping;
}

function createNoBattleRankingError({
  attempt,
  finishReason,
  judgeModelId,
  rawFinishReason,
  responseId,
}: {
  attempt: number;
  finishReason: string;
  judgeModelId: string;
  rawFinishReason: string;
  responseId: string;
}): NoOutputGeneratedError {
  return new NoOutputGeneratedError({
    message: `Battle judge ${judgeModelId} generated no rankings on attempt ${attempt} of ${MAX_BATTLE_RANKING_ATTEMPTS} (finishReason=${finishReason}, rawFinishReason=${rawFinishReason}, responseId=${responseId}).`,
  });
}

async function generateBattleRankingResult({
  attempt = 1,
  judgeId,
  prompt,
  schema,
}: {
  attempt?: number;
  judgeId: string;
  prompt: string;
  schema: z.ZodType<BattleRankingResult>;
}): Promise<BattleRankingGeneration> {
  const generationResult = await safeAsync(() =>
    generateText({
      instructions: battleSystemPrompt,
      model: judgeId,
      output: Output.object({ schema }),
      prompt,
    }),
  );

  if (generationResult.error) {
    throw generationResult.error;
  }

  const generation = generationResult.data;
  const usage = toTokenUsage(generation.usage);

  if (generation.finishReason === "stop") {
    return { result: generation.output, usage };
  }

  const finishReason = generation.finishReason ?? "missing";
  const rawFinishReason = generation.rawFinishReason ?? "missing";

  const error = createNoBattleRankingError({
    attempt,
    finishReason,
    judgeModelId: judgeId,
    rawFinishReason,
    responseId: generation.finalStep.response.id,
  });

  logError(error.message, {
    providerMetadata: generation.finalStep.providerMetadata,
    textLength: generation.text.length,
    usage: generation.usage,
    warnings: generation.warnings,
  });

  if (attempt >= MAX_BATTLE_RANKING_ATTEMPTS) {
    throw error;
  }

  const retry = await generateBattleRankingResult({
    attempt: attempt + 1,
    judgeId,
    prompt,
    schema,
  });

  return { result: retry.result, usage: addUsage(usage, retry.usage) };
}

export async function generateBattleRankings(params: {
  judgeId: string;
  expectations: string;
  userPrompt: string;
  anonymizedOutputs: { anonymousId: string; output: string }[];
  mapping: { anonymousId: string; modelId: string }[];
  scoreCategories?: ScoreCategory[];
}): Promise<{ rankings: ModelRanking[]; usage: TokenUsage }> {
  const { judgeId, expectations, userPrompt, anonymizedOutputs, mapping, scoreCategories } = params;

  const outputsSection = anonymizedOutputs
    .map((output) => `### ${output.anonymousId}\n\`\`\`json\n${output.output}\n\`\`\``)
    .join("\n\n");

  const categoriesSection = scoreCategories
    ? `
## Score Categories
Score every category independently for every output. A strength in one category must not erase a weakness in another.

${formatScoreCategories(scoreCategories)}
`
    : "";

  const evalPrompt = `
## Task Expectations
${expectations}

${categoriesSection}

## User Provided Values
${userPrompt}

## Model Outputs to Compare
${outputsSection}

Evaluate each model's output against the task expectations and user-provided values, then rank them from best to worst.
Ties are allowed if outputs are truly equivalent in quality.
`;

  const schema = scoreCategories ? categorizedBattleRankingSchema : battleRankingSchema;

  const { result, usage } = await generateBattleRankingResult({
    judgeId,
    prompt: evalPrompt,
    schema,
  });

  const rankings = result.rankings.map((ranking): ModelRanking => {
    const modelMapping = getModelMapping({ anonymousId: ranking.anonymousId, judgeId, mapping });

    if (scoreCategories && "categoryScores" in ranking) {
      const categoryScores = resolveCategoryScores({
        categories: scoreCategories,
        judgeScores: ranking.categoryScores,
      });

      return {
        anonymousId: modelMapping.anonymousId,
        categoryScores,
        modelId: modelMapping.modelId,
        reasoning: ranking.reasoning,
        score: calculateScore({ categoryScores, steps: [] }),
      };
    }

    if (!("score" in ranking)) {
      throw new Error(`Battle judge ${judgeId} omitted category scores.`);
    }

    return {
      anonymousId: modelMapping.anonymousId,
      modelId: modelMapping.modelId,
      reasoning: ranking.reasoning,
      score: ranking.score,
    };
  });

  return { rankings, usage };
}
