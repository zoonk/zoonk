import { Output, generateText } from "ai";
import z from "zod";
import battleSystemPrompt from "./battle-system-prompt.md";
import { type ModelRanking } from "./types";

const modelRankingSchema = z.object({
  anonymousId: z.string(),
  reasoning: z.string(),
  score: z.number().min(1).max(10),
});

const battleRankingSchema = z.object({
  rankings: z.array(modelRankingSchema),
});

export async function generateBattleRankings(params: {
  judgeId: string;
  expectations: string;
  systemPrompt: string;
  userPrompt: string;
  anonymizedOutputs: {
    anonymousId: string;
    output: string;
  }[];
  mapping: { anonymousId: string; modelId: string }[];
}): Promise<ModelRanking[]> {
  const { judgeId, expectations, systemPrompt, userPrompt, anonymizedOutputs, mapping } = params;

  const outputsSection = anonymizedOutputs
    .map((output) => `### ${output.anonymousId}\n\`\`\`json\n${output.output}\n\`\`\``)
    .join("\n\n");

  const evalPrompt = `
## Original Task Prompt

### System Prompt
${systemPrompt}

### User Prompt
${userPrompt}

## Task Expectations
${expectations}

## Model Outputs to Compare
${outputsSection}

Evaluate each model's output against the original task prompt, expectations, and rank them from best to worst.
Ties are allowed if outputs are truly equivalent in quality.
`;

  const { output: result } = await generateText({
    model: judgeId,
    output: Output.object({ schema: battleRankingSchema }),
    prompt: evalPrompt,
    system: battleSystemPrompt,
  });

  // Map anonymous IDs back to model IDs
  const rankings: ModelRanking[] = result.rankings.map((ranking) => {
    const modelMapping = mapping.find((entry) => entry.anonymousId === ranking.anonymousId);
    return {
      anonymousId: ranking.anonymousId,
      modelId: modelMapping?.modelId ?? ranking.anonymousId,
      reasoning: ranking.reasoning,
      score: ranking.score,
    };
  });

  return rankings;
}
