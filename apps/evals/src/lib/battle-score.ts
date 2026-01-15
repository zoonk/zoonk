import { generateText, Output } from "ai";
import z from "zod";
import battleSystemPrompt from "./battle-system-prompt.md";
import type { ModelRanking } from "./types";

const modelRankingSchema = z.object({
  anonymousId: z.string(),
  reasoning: z.string(),
  score: z.number().min(1).max(10),
});

const battleRankingSchema = z.object({
  rankings: z.array(modelRankingSchema),
});

function validateNoTies(rankings: ModelRanking[]): boolean {
  const scores = rankings.map((r) => r.score);
  const uniqueScores = new Set(scores);
  return scores.length === uniqueScores.size;
}

type AnonymizedOutput = {
  anonymousId: string;
  output: string;
};

export async function generateBattleRankings(params: {
  judgeId: string;
  testCaseId: string;
  expectations: string;
  anonymizedOutputs: AnonymizedOutput[];
  mapping: Array<{ anonymousId: string; modelId: string }>;
}): Promise<ModelRanking[]> {
  const { judgeId, testCaseId, expectations, anonymizedOutputs, mapping } =
    params;

  console.info(
    `Battle scoring test case ${testCaseId} with judge ${judgeId}...`,
  );

  const outputsSection = anonymizedOutputs
    .map(
      (output) =>
        `### ${output.anonymousId}\n\`\`\`json\n${output.output}\n\`\`\``,
    )
    .join("\n\n");

  const evalPrompt = `
## Task Expectations
${expectations}

## Model Outputs to Compare
${outputsSection}

Evaluate each model's output against the expectations and rank them from best to worst.
Remember: Each model MUST receive a DIFFERENT score (no ties allowed).
`;

  const { output: result } = await generateText({
    model: judgeId,
    output: Output.object({ schema: battleRankingSchema }),
    prompt: evalPrompt,
    system: battleSystemPrompt,
  });

  // Map anonymous IDs back to model IDs
  const rankings: ModelRanking[] = result.rankings.map((ranking) => {
    const modelMapping = mapping.find(
      (m) => m.anonymousId === ranking.anonymousId,
    );
    return {
      anonymousId: ranking.anonymousId,
      modelId: modelMapping?.modelId ?? ranking.anonymousId,
      reasoning: ranking.reasoning,
      score: ranking.score,
    };
  });

  if (!validateNoTies(rankings)) {
    console.warn(
      `Judge ${judgeId} returned tied scores for ${testCaseId}, requesting re-evaluation...`,
    );
    // Could implement retry logic here, but for now we'll accept and log
  }

  console.info(
    `Battle complete for ${testCaseId}: ${rankings.map((r) => `${r.anonymousId}=${r.score}`).join(", ")}`,
  );

  return rankings;
}
