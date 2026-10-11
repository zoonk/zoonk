import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "../planner/plan-items";
import { isStandIn } from "./stand-in-lessons";

/** An item as a plan saves it: `id` is kept for items that were already in the plan. */
export type SavedPlanItem = Omit<PlannedItem, "key" | "minutes">;

/**
 * When the plan's learner first finished each of these lessons, from their own ledger rows, with
 * the rule `listFinishedLessonIds` uses for a finished lesson.
 */
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
 * Writes a planning run's items in place. Todo items that left the plan are deleted; kept items get
 * their new position, phase, date and the skill they count for (a shared chapter's lesson can count
 * for another skill once that skill's lessons are outlined) without touching their status, so a
 * lesson finished while the plan was being computed stays finished, but a todo item the run sets
 * aside (`skipped`, see `setAsideLeftWork`) and a set-aside one a learner's change plans again
 * (see `BuildPlanInput.bringBackSetAside`); new items are created. One statement per step. A
 * stand-in keeps the lessons the plan teaches in its place (`standInLessons`), which every screen
 * counts it as. A new lesson item the learner already finished, such as a guest's lesson from a
 * public page before "Build my plan" made the goal, is done from when it ended, as finishing it
 * checks it off in every plan that has it (`completeLessonPlanItems`).
 *
 * Every position moves out of the way first, past both the old and the new ones, so no row ever
 * takes a position another still holds (Postgres checks the plan's unique positions row by row). A
 * row the run left out that can't be deleted, such as a lesson finished meanwhile, then follows
 * the plan's items, so positions stay in order for the next save.
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
  /** The lessons each skill's stand-in teaches after cuts and base choices. */
  standInLessons: ReadonlyMap<string, number>;
  tx: TransactionClient;
}): Promise<void> {
  const lessonsOf = (item: SavedPlanItem) =>
    isStandIn(item) ? (standInLessons.get(item.skillId ?? "") ?? null) : null;

  const keptIds = new Set(items.flatMap((item) => (item.id ? [item.id] : [])));
  const removedIds = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
  const positioned = items.map((item, position) => ({ item, position }));
  const kept = positioned.filter(({ item }) => item.id !== null);
  const fresh = positioned.filter(({ item }) => item.id === null);

  await tx.$executeRaw`
    UPDATE plan_items
    SET position = position + (
      SELECT GREATEST(MAX(position) + 1, ${items.length}::int + COUNT(*)::int)
      FROM plan_items
      WHERE plan_id = ${planId}::uuid
    )
    WHERE plan_id = ${planId}::uuid`;

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
        skill_id = v.skill_id,
        lessons = v.lessons,
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
        ${kept.map(({ item }) => item.status === "todo")}::boolean[]
      ) AS v(id, position, phase, scheduled_for, chapter_id, skill_id, lessons, title_snapshot, set_aside, to_do)
      WHERE p.id = v.id AND p.plan_id = ${planId}::uuid`;
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
        kind: item.kind,
        lessonId: item.lessonId,
        lessons: lessonsOf(item),
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
