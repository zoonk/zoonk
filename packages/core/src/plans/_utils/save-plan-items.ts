import "server-only";
import { DbNull, type PlanItem, type TransactionClient } from "@zoonk/db";
import { toIsoDate } from "../planner/plan-calendar";
import { isStandIn } from "../planner/plan-item-rules";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";
import { readSelectedItemFacts } from "./selected-item-contract";

export type SavedPlanItem = Omit<PlannedItem, "key" | "minutes"> & {
  facts?: PlanItem["facts"];
  minutes?: number | null;
};

async function findLessonFinishes({
  lessonIds,
  planId,
  tx,
}: {
  lessonIds: readonly string[];
  planId: string;
  tx: TransactionClient;
}): Promise<Map<string, Date>> {
  if (lessonIds.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<{ endedAt: Date; lessonId: string }[]>`
    SELECT e.content_ids->>'lessonId' AS "lessonId", MIN(e.ended_at) AS "endedAt"
    FROM learning_events AS e
    JOIN goals AS g ON g.user_id = e.user_id
    JOIN plans AS p ON p.goal_id = g.id
    WHERE p.id = ${planId}::uuid
      AND e.kind IN ('lesson', 'review')
      AND e.ended_at IS NOT NULL
      AND e.content_ids->>'lessonId' = ANY(${lessonIds}::text[])
    GROUP BY 1`;

  return new Map(rows.map((row) => [row.lessonId, row.endedAt]));
}

/**
 * Kept items keep their status, so a lesson finished while the plan was computed stays finished. A
 * moving row goes past both its old and new positions first: Postgres checks the plan's unique
 * positions row by row.
 */
export async function savePlanItems({
  existing,
  items,
  planId,
  standInLessons,
  tx,
}: {
  existing: readonly ExistingPlanItem[];
  items: readonly SavedPlanItem[];
  planId: string;
  standInLessons: ReadonlyMap<string, number>;
  tx: TransactionClient;
}): Promise<void> {
  const lessonsOf = (item: SavedPlanItem) =>
    isStandIn(item) ? (standInLessons.get(item.skillId ?? "") ?? null) : null;

  const factsOf = (item: SavedPlanItem) => readSelectedItemFacts(item.facts);

  const keptIds = new Set(items.flatMap((item) => (item.id ? [item.id] : [])));
  const existingIds = new Set(existing.map((item) => item.id));
  const removedIds = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
  const positioned = items.map((item, position) => ({ item, position }));
  const kept = positioned.filter(({ item }) => item.id !== null && existingIds.has(item.id));
  const fresh = positioned.filter(({ item }) => item.id === null || !existingIds.has(item.id));

  if (removedIds.length > 0) {
    await tx.planItem.deleteMany({ where: { id: { in: removedIds }, planId, status: "todo" } });
  }

  await tx.$executeRaw`
    UPDATE plan_items AS p
    SET position = p.position + (
      SELECT GREATEST(MAX(position) + 1, ${items.length}::int + COUNT(*)::int)
      FROM plan_items
      WHERE plan_id = ${planId}::uuid
    )
    WHERE p.plan_id = ${planId}::uuid
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(
          ${kept.map(({ item }) => item.id)}::uuid[],
          ${kept.map(({ position }) => position)}::int[]
        ) AS v(id, position)
        WHERE v.id = p.id AND v.position = p.position
      )`;

  if (kept.length > 0) {
    await tx.$executeRaw`
      UPDATE plan_items AS p
      SET position = v.position,
        phase = v.phase::smallint,
        scheduled_for = v.scheduled_for,
        chapter_id = v.chapter_id,
        skill_id = v.skill_id,
        lessons = v.lessons,
        minutes = v.minutes,
        facts = v.facts::jsonb,
        title_snapshot = v.title_snapshot,
        status = CASE
          WHEN v.set_aside AND p.status = 'todo' THEN 'skipped'
          WHEN v.to_do AND p.status = 'skipped' THEN 'todo'
          ELSE p.status
        END,
        updated_at = now()
      FROM unnest(
        ${kept.map(({ item }) => item.id)}::uuid[],
        ${kept.map(({ position }) => position)}::int[],
        ${kept.map(({ item }) => item.phase)}::int[],
        ${kept.map(({ item }) => (item.scheduledFor ? toIsoDate(item.scheduledFor) : null))}::date[],
        ${kept.map(({ item }) => item.chapterId)}::uuid[],
        ${kept.map(({ item }) => item.skillId)}::uuid[],
        ${kept.map(({ item }) => lessonsOf(item))}::smallint[],
        ${kept.map(({ item }) => item.titleSnapshot)}::text[],
        ${kept.map(({ item }) => item.status === "skipped")}::boolean[],
        ${kept.map(({ item }) => item.status === "todo")}::boolean[],
        ${kept.map(({ item }) => item.minutes ?? null)}::double precision[],
        ${kept.map(({ item }) => (factsOf(item) ? JSON.stringify(factsOf(item)) : null))}::text[]
      ) AS v(id, position, phase, scheduled_for, chapter_id, skill_id, lessons, title_snapshot, set_aside, to_do, minutes, facts)
      WHERE p.id = v.id AND p.plan_id = ${planId}::uuid
        AND (
          (p.position, p.phase, p.scheduled_for, p.chapter_id, p.skill_id, p.lessons, p.minutes, p.facts, p.title_snapshot)
            IS DISTINCT FROM
          (v.position, v.phase::smallint, v.scheduled_for, v.chapter_id, v.skill_id, v.lessons, v.minutes, v.facts::jsonb, v.title_snapshot)
          OR (v.set_aside AND p.status = 'todo')
          OR (v.to_do AND p.status = 'skipped')
        )`;
  }

  if (fresh.length > 0) {
    const finishes = await findLessonFinishes({
      lessonIds: fresh.flatMap(({ item }) =>
        item.kind === "lesson" && item.lessonId ? [item.lessonId] : [],
      ),
      planId,
      tx,
    });

    const finishOf = (item: SavedPlanItem) =>
      item.kind === "lesson" && item.lessonId && item.status === "todo"
        ? finishes.get(item.lessonId)
        : undefined;

    await tx.planItem.createMany({
      data: fresh.map(({ item, position }) => ({
        chapterId: item.chapterId,
        completedAt: finishOf(item) ?? null,
        facts: factsOf(item) ?? DbNull,
        id: item.id ?? undefined,
        kind: item.kind,
        lessonId: item.lessonId,
        lessons: lessonsOf(item),
        minutes: item.minutes ?? null,
        phase: item.phase,
        planId,
        position,
        scheduledFor: item.scheduledFor,
        skillId: item.skillId,
        status: finishOf(item) ? "done" : item.status,
        titleSnapshot: item.titleSnapshot,
      })),
    });
  }

  if (removedIds.length > 0) {
    await tx.$executeRaw`
      UPDATE plan_items AS p
      SET position = ${items.length}::int + v.rank::int - 1
      FROM (
        SELECT id, row_number() OVER (ORDER BY position) AS rank
        FROM plan_items
        WHERE plan_id = ${planId}::uuid AND position >= ${items.length}::int
      ) AS v
      WHERE p.id = v.id`;
  }
}
