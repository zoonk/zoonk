import "server-only";
import { prisma } from "@zoonk/db";
import {
  type SessionPlanItem,
  getSessionItemIdentity,
} from "../../../sessions/_utils/session-plan-item";
import { type DayView } from "../../../sessions/day-view";

/**
 * The plan's lessons today's session still holds, as they add to its progress: each plan item once
 * (a bonus copy of a lesson is the same lesson), and only while it's still to do, so a lesson
 * finished elsewhere (another goal's session sharing it, a copy already done) no longer counts.
 */
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

    // Unsaved first-layout lessons have real logical keys; alphabet/reinforcement are not plan work.
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
