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

/**
 * The learners that still exist and the owner of each goal that does, to keep only links that can
 * be saved.
 */
async function findLinkedIds(rows: readonly AiCallRow[]) {
  const userIds = [...new Set(rows.flatMap((row) => (row.userId ? [row.userId] : [])))];
  const goalIds = [...new Set(rows.flatMap((row) => (row.goalId ? [row.goalId] : [])))];

  const [users, goals] = await Promise.all([
    prisma.user.findMany({ select: { id: true }, where: { id: { in: userIds } } }),
    prisma.goal.findMany({ select: { id: true, userId: true }, where: { id: { in: goalIds } } }),
  ]);

  return {
    goalOwners: new Map(goals.map((goal) => [goal.id, goal.userId])),
    userIds: new Set(users.map((user) => user.id)),
  };
}

/**
 * Saves AI calls in one insert. A learner or goal deleted while its calls ran keeps the calls,
 * and their cost, without the link. A guest who signed up while theirs ran is gone too, but their
 * goal moved to the account (see `linkGuestAccount`), so the goal's owner gets the call.
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
      data: rows.map((row) => {
        const goalOwner = row.goalId ? linked.goalOwners.get(row.goalId) : undefined;

        return {
          ...row,
          goalId: goalOwner ? row.goalId : null,
          userId: row.userId && linked.userIds.has(row.userId) ? row.userId : (goalOwner ?? null),
        };
      }),
    });
  }
}
