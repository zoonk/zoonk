import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { readEssayContent } from "./_utils/essay-content";

export type WritingRequest = {
  count: number;
  skillId?: string;
  taskKey: string;
  unit: "answer" | "drill";
};

export async function findWritingPrompts({
  goalId,
  requests,
  tx,
  userId,
}: {
  goalId: string;
  requests: WritingRequest[];
  tx: TransactionClient;
  userId: string;
}): Promise<
  { itemIds: string[]; status: "ready" } | { requests: WritingRequest[]; status: "missing" }
> {
  const goal = await tx.goal.findFirst({
    select: {
      examBlueprint: { select: { id: true, ownerId: true, visibility: true } },
      language: true,
    },
    where: { id: goalId, kind: "exam", userId },
  });

  const blueprint = goal?.examBlueprint;

  if (!blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return { requests, status: "missing" };
  }

  const items = await tx.item.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    where: {
      OR: requests.map(({ taskKey, unit }) => ({
        AND: [
          { content: { equals: taskKey, path: ["writing", "taskKey"] } },
          { content: { equals: unit, path: ["writing", "unit"] } },
        ],
      })),
      attempts: { none: { userId } },
      examBlueprintId: blueprint.id,
      field: null,
      format: "essay",
      language: goal.language,
      retiredAt: null,
      setId: null,
      skill: { ownerId: blueprint.ownerId, visibility: blueprint.visibility },
    },
  });

  const exposures = await tx.writingAdmission.findMany({
    select: { itemIds: true },
    where: { itemIds: { hasSome: items.map(({ id }) => id) }, userId },
  });

  const used = new Set(exposures.flatMap(({ itemIds }) => itemIds));

  const bank = items.flatMap((item) => {
    const writing = readEssayContent(item)?.writing;
    return writing ? [{ id: item.id, writing }] : [];
  });

  const missing: WritingRequest[] = [];
  const itemIds: string[] = [];

  for (const request of requests) {
    const matches = bank
      .filter(
        ({ id, writing }) =>
          !used.has(id) &&
          writing.taskKey === request.taskKey &&
          writing.unit === request.unit &&
          (request.unit === "answer" ||
            (writing.assessedSkillIds.length === 1 &&
              writing.assessedSkillIds[0] === request.skillId)),
      )
      .slice(0, request.count);

    for (const { id } of matches) {
      used.add(id);
      itemIds.push(id);
    }

    if (matches.length < request.count) {
      missing.push({ ...request, count: request.count - matches.length });
    }
  }

  return missing.length > 0
    ? { requests: missing, status: "missing" }
    : { itemIds, status: "ready" };
}
