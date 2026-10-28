import "server-only";
import { prisma } from "@zoonk/db";
import {
  type SessionPlanItem,
  getSessionItemIdentity,
} from "../../../sessions/_utils/session-plan-item";
import { type DayView } from "../../../sessions/day-view";

/** Counts unfinished plan items once even when bonus blocks duplicate them or another session completes them. */
export async function countLessonsLeftToday({
  selectedItems,
  session,
}: {
  selectedItems?: readonly SessionPlanItem[];
  session: DayView;
}): Promise<number> {
  const blocks = session.blocks.filter(
    (block) =>
      block.kind === "learn" &&
      !block.reinforcement &&
      (block.status === "pending" || block.status === "active"),
  );

  if (session.status === "unstarted" && selectedItems) {
    const todo = new Set(
      selectedItems
        .filter(
          (item) => item.status === "todo" && (item.kind === "lesson" || item.kind === "chapter"),
        )
        .map((item) => getSessionItemIdentity(item)),
    );

    // Unsaved work uses logical keys; alphabet and reinforcement blocks do not count as plan lessons.
    return new Set(
      blocks.flatMap((block) => {
        const key = block.planItemId ?? block.planItemKey;
        return key && todo.has(key) ? [key] : [];
      }),
    ).size;
  }

  const planItemIds = [...new Set(blocks.flatMap((block) => block.planItemId ?? []))];

  if (planItemIds.length === 0) {
    return 0;
  }

  return prisma.planItem.count({ where: { id: { in: planItemIds }, status: "todo" } });
}
