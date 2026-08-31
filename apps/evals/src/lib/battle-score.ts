import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { NoOutputGeneratedError, Output, generateText } from "ai";
import z from "zod";
import { normalizeAnonymousId } from "./battle-mapping";
import battleSystemPrompt from "./battle-system-prompt.md";
import { calculateScore } from "./score-calculation";
import { formatScoreCategories, resolveCategoryScores } from "./score-categories";
import { type ModelRanking, type ScoreCategory, judgeCategoryScoreSchema } from "./types";

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

/**
 * Rejects labels that cannot be connected to an anonymized output instead of
 * persisting the judge's label as though it were a configured model ID.
 */
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

/**
 * Adds the provider completion details that AI SDK's default output getter
 * omits. These fields distinguish truncation, filtering, and Gateway responses
 * that forgot to include a finish reason without logging the generated text.
 */
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

/**
 * Retries only the successful provider calls that ended without a complete
 * structured output. AI SDK retries transport/provider exceptions itself, but
 * it does not retry this post-generation state because the request completed.
 */
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
}): Promise<BattleRankingResult> {
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

  if (generation.finishReason === "stop") {
    return generation.output;
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

  return generateBattleRankingResult({ attempt: attempt + 1, judgeId, prompt, schema });
}

/**
 * Asks one judge to score every anonymized contestant and maps the judge's
 * labels back to the model IDs used by the persisted battle leaderboard.
 */
export async function generateBattleRankings(params: {
  judgeId: string;
  expectations: string;
  userPrompt: string;
  anonymizedOutputs: { anonymousId: string; output: string }[];
  mapping: { anonymousId: string; modelId: string }[];
  scoreCategories?: ScoreCategory[];
}): Promise<ModelRanking[]> {
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
  const result = await generateBattleRankingResult({ judgeId, prompt: evalPrompt, schema });

  return result.rankings.map((ranking) => {
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
}
