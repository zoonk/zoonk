import "server-only";
import { prisma } from "@zoonk/db";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { parsePlanChangePayload } from "./plan-change-payload";

/**
 * The skills of a goal's test-outs the learner undid, from the moment of each test-out: they asked
 * to study them, so the answers before it no longer show they know them (see `ClaimEvent`). Undone,
 * a class test's skipped organelles came back, and a plan short on time cut them first again as
 * known, ahead of cell theory the learner had missed.
 */
export async function loadUndoneTestOuts({
  goalId,
  skillIds,
}: {
  goalId: string;
  skillIds: ReadonlySet<string>;
}): Promise<ClaimEvent[]> {
  const changes = await prisma.planChange.findMany({
    select: { createdAt: true, payload: true },
    where: { kind: "testedOut", plan: { goalId }, status: "undone" },
  });

  const undone = changes.flatMap((change) =>
    parsePlanChangePayload(change.payload).planItemIds.map((itemId) => ({
      at: change.createdAt,
      itemId,
    })),
  );

  if (undone.length === 0) {
    return [];
  }

  const items = await prisma.planItem.findMany({
    select: {
      id: true,
      lesson: { select: { skills: { select: { skillId: true } } } },
      skillId: true,
    },
    where: { id: { in: undone.map((entry) => entry.itemId) } },
  });

  const skillsOf = new Map(
    items.map((item) => [
      item.id,
      [
        ...new Set([
          ...(item.skillId ? [item.skillId] : []),
          ...(item.lesson?.skills ?? []).map((row) => row.skillId),
        ]),
      ],
    ]),
  );

  return undone.flatMap(({ at, itemId }) =>
    (skillsOf.get(itemId) ?? [])
      .filter((skillId) => skillIds.has(skillId))
      .map((skillId): ClaimEvent => ({ at, kind: "undone", skillId })),
  );
}
