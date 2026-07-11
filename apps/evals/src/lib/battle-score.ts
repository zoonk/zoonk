import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { NoOutputGeneratedError, Output, generateText } from "ai";
import z from "zod";
import battleSystemPrompt from "./battle-system-prompt.md";
import { type ModelRanking } from "./types";

const MAX_BATTLE_RANKING_ATTEMPTS = 3;

const modelRankingSchema = z.object({
  anonymousId: z.string(),
  reasoning: z.string(),
  score: z.number().min(1).max(10),
});

const battleRankingSchema = z.object({ rankings: z.array(modelRankingSchema) });
type BattleRankingResult = z.infer<typeof battleRankingSchema>;

/**
 * Judges do not always preserve the exact anonymous label formatting from the
 * prompt. Normalizing the harmless `Model` prefix and trailing colon lets the
 * saved result retain the original anonymous-to-model mapping.
 */
function normalizeAnonymousId(id: string): string {
  return id
    .replace(/^Model\s+/iu, "")
    .replace(/:$/u, "")
    .trim();
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
}: {
  attempt?: number;
  judgeId: string;
  prompt: string;
}): Promise<BattleRankingResult> {
  const generationResult = await safeAsync(() =>
    generateText({
      instructions: battleSystemPrompt,
      model: judgeId,
      output: Output.object({ schema: battleRankingSchema }),
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

  return generateBattleRankingResult({ attempt: attempt + 1, judgeId, prompt });
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
}): Promise<ModelRanking[]> {
  const { judgeId, expectations, userPrompt, anonymizedOutputs, mapping } = params;

  const outputsSection = anonymizedOutputs
    .map((output) => `### ${output.anonymousId}\n\`\`\`json\n${output.output}\n\`\`\``)
    .join("\n\n");

  const evalPrompt = `
## Task Expectations
${expectations}

## User Provided Values
${userPrompt}

## Model Outputs to Compare
${outputsSection}

Evaluate each model's output against the task expectations and user-provided values, then rank them from best to worst.
Ties are allowed if outputs are truly equivalent in quality.
`;

  const result = await generateBattleRankingResult({ judgeId, prompt: evalPrompt });

  // Map anonymous IDs back to model IDs, normalizing format variations.
  const rankings: ModelRanking[] = result.rankings.map((ranking) => {
    const normalizedRanking = normalizeAnonymousId(ranking.anonymousId);

    const modelMapping = mapping.find(
      (entry) => normalizeAnonymousId(entry.anonymousId) === normalizedRanking,
    );

    return {
      anonymousId: modelMapping?.anonymousId ?? ranking.anonymousId,
      modelId: modelMapping?.modelId ?? ranking.anonymousId,
      reasoning: ranking.reasoning,
      score: ranking.score,
    };
  });

  return rankings;
}
