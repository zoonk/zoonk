import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { parsePlanChangePayload } from "./plan-change-payload";

/** Every skill the goal's undone test-outs touched, whichever skills the caller asks about. */
export async function loadUndoneTestOuts(
  goalId: string,
  { timeZone = "UTC", tx = prisma }: { timeZone?: string; tx?: TransactionClient } = {},
): Promise<ClaimEvent[]> {
  const changes = await tx.planChange.findMany({
    select: { createdAt: true, payload: true },
    where: { kind: "testedOut", plan: { goalId }, status: "undone" },
  });

  const undone = changes.flatMap((change) => {
    const { planItemIds, undoneAt } = parsePlanChangePayload(change.payload);
    const at = undoneAt ? new Date(undoneAt) : change.createdAt;
    const localDate = undoneAt ? getDateInTimeZone({ date: at, timeZone }) : undefined;
    return planItemIds.map((itemId) => ({ at, itemId, localDate }));
  });

  if (undone.length === 0) {
    return [];
  }

  const items = await tx.planItem.findMany({
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

  return undone.flatMap(({ at, itemId, localDate }) =>
    (skillsOf.get(itemId) ?? []).map((skillId): ClaimEvent => ({
      at,
      kind: "undone",
      localDate,
      skillId,
    })),
  );
}
