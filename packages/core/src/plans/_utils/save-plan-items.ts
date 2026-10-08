import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";

/** Moves every position out of the way first, so the new order never collides with the old one. */
const POSITION_OFFSET = 1_000_000;

/**
 * Writes a planning run's items in place. Todo items that left the plan are deleted; kept items get
 * their new position, phase and date without touching their status, so a lesson finished while
 * the plan was being computed stays finished; new items are created. One statement per step.
 */
export async function savePlanItems({
  existing,
  items,
  planId,
  tx,
}: {
  existing: readonly ExistingPlanItem[];
  items: readonly PlannedItem[];
  planId: string;
  tx: TransactionClient;
}): Promise<void> {
  const keptIds = new Set(items.flatMap((item) => (item.id ? [item.id] : [])));
  const removedIds = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
  const positioned = items.map((item, position) => ({ item, position }));
  const kept = positioned.filter(({ item }) => item.id !== null);
  const fresh = positioned.filter(({ item }) => item.id === null);

  await tx.$executeRaw`
    UPDATE plan_items SET position = position + ${POSITION_OFFSET} WHERE plan_id = ${planId}::uuid`;

  if (removedIds.length > 0) {
    await tx.planItem.deleteMany({ where: { id: { in: removedIds }, planId, status: "todo" } });
  }

  if (kept.length > 0) {
    await tx.$executeRaw`
      UPDATE plan_items AS p
      SET position = v.position,
        phase = v.phase::smallint,
        scheduled_for = v.scheduled_for,
        chapter_id = v.chapter_id,
        title_snapshot = v.title_snapshot,
        updated_at = now()
      FROM unnest(
        ${kept.map(({ item }) => item.id)}::uuid[],
        ${kept.map(({ position }) => position)}::int[],
        ${kept.map(({ item }) => item.phase)}::int[],
        ${kept.map(({ item }) => (item.scheduledFor ? toIsoDate(item.scheduledFor) : null))}::date[],
        ${kept.map(({ item }) => item.chapterId)}::uuid[],
        ${kept.map(({ item }) => item.titleSnapshot)}::text[]
      ) AS v(id, position, phase, scheduled_for, chapter_id, title_snapshot)
      WHERE p.id = v.id AND p.plan_id = ${planId}::uuid`;
  }

  if (fresh.length > 0) {
    await tx.planItem.createMany({
      data: fresh.map(({ item, position }) => ({
        chapterId: item.chapterId,
        kind: item.kind,
        lessonId: item.lessonId,
        phase: item.phase,
        planId,
        position,
        scheduledFor: item.scheduledFor,
        skillId: item.skillId,
        status: item.status,
        titleSnapshot: item.titleSnapshot,
      })),
    });
  }
}
