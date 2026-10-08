import "server-only";
import { type AiGeneration } from "@zoonk/ai/ai-generation-sink";
import { type AiCallCreateManyInput, isPrismaForeignKeyError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

export type AiCallRow = AiCallCreateManyInput;

function toCount(value: number | undefined): number {
  return value === undefined ? 0 : Math.round(value);
}

/** One finished AI call as its `ai_calls` row. */
export function toAiCallRow({ context = {}, provenance, task }: AiGeneration): AiCallRow {
  const { usage } = provenance;

  return {
    audioSeconds: usage.audioSeconds ?? null,
    cacheReadTokens: toCount(usage.cacheReadTokens),
    cacheWriteTokens: toCount(usage.cacheWriteTokens),
    characters: usage.characters ?? null,
    contentScope: context.contentScope ?? "shared",
    costUsd: provenance.costUsd ?? null,
    createdAt: new Date(provenance.generatedAt),
    credential: provenance.credential ?? null,
    gatewayCostUsd: provenance.gatewayCostUsd ?? null,
    goalId: isUuid(context.goalId) ? context.goalId : null,
    images: usage.images ?? null,
    inputTokens: toCount(usage.inputTokens),
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    outputTokens: toCount(usage.outputTokens),
    promptVersion: provenance.promptVersion,
    provider: provenance.provider,
    reasoningTokens: toCount(usage.reasoningTokens),
    requestedModel: provenance.requestedModel,
    runId: provenance.runId,
    serviceTier: provenance.serviceTier ?? null,
    task,
    traceId: context.traceId ?? null,
    userId: isUuid(context.distinctId) ? context.distinctId : null,
  };
}

/** The learner and goal ids of the rows that still exist, to keep only links that can be saved. */
async function findLinkedIds(rows: readonly AiCallRow[]) {
  const userIds = [...new Set(rows.flatMap((row) => (row.userId ? [row.userId] : [])))];
  const goalIds = [...new Set(rows.flatMap((row) => (row.goalId ? [row.goalId] : [])))];

  const [users, goals] = await Promise.all([
    prisma.user.findMany({ select: { id: true }, where: { id: { in: userIds } } }),
    prisma.goal.findMany({ select: { id: true }, where: { id: { in: goalIds } } }),
  ]);

  return {
    goalIds: new Set(goals.map((goal) => goal.id)),
    userIds: new Set(users.map((user) => user.id)),
  };
}

/**
 * Saves AI calls in one insert. A learner or goal deleted while its calls ran keeps the calls,
 * and their cost, without the link.
 */
export async function writeAiCalls(rows: readonly AiCallRow[]): Promise<void> {
  try {
    await prisma.aiCall.createMany({ data: [...rows] });
  } catch (error) {
    if (!isPrismaForeignKeyError(error)) {
      throw error;
    }

    const linked = await findLinkedIds(rows);

    await prisma.aiCall.createMany({
      data: rows.map((row) => ({
        ...row,
        goalId: row.goalId && linked.goalIds.has(row.goalId) ? row.goalId : null,
        userId: row.userId && linked.userIds.has(row.userId) ? row.userId : null,
      })),
    });
  }
}
