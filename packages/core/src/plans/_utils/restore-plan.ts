import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type ContextPlanItem, type PlanContext } from "./plan-context";
import { type PlanSnapshot, getSnapshotStandInLessons, parsePlanSnapshot } from "./plan-snapshot";
import { reduceRestoredSummary } from "./plan-summary";
import { writePlan } from "./write-plan";

/** The plan right before a change, which its undo puts back; null when it has none. */
export async function loadPlanSnapshot(changeId: string): Promise<PlanSnapshot | null> {
  const stored = await prisma.planChangeSnapshot.findUnique({ where: { changeId } });
  return stored ? parsePlanSnapshot(stored.plan) : null;
}

/** The distinct ids an item field names across the snapshot. */
function listIds(
  snapshot: PlanSnapshot,
  pick: (item: PlanSnapshot["items"][number]) => string | null,
): string[] {
  return [...new Set(snapshot.items.flatMap((item) => pick(item) ?? []))];
}

/**
 * Whether every lesson, chapter and skill the snapshot's items name still exists: one the Library
 * deleted or merged since can't be put back, so the undo can't give back the plan as it was.
 */
export async function canRestore(snapshot: PlanSnapshot): Promise<boolean> {
  const lessonIds = listIds(snapshot, (item) => item.lessonId);
  const chapterIds = listIds(snapshot, (item) => item.chapterId);
  const skillIds = listIds(snapshot, (item) => item.skillId);

  const counts = await Promise.all([
    prisma.lesson.count({ where: { id: { in: lessonIds } } }),
    prisma.chapter.count({ where: { id: { in: chapterIds } } }),
    prisma.skill.count({ where: { id: { in: skillIds } } }),
  ]);

  return isDeepStrictEqual(counts, [lessonIds.length, chapterIds.length, skillIds.length]);
}

/**
 * Gives the items the snapshot has with a status (todo, or set aside) that status back, but what
 * the learner finished since, which stays done: a change can set an item aside, or bring one back,
 * and `savePlanItems` keeps a kept row's status.
 */
function restoreStatus({
  items,
  planId,
  status,
  tx,
}: {
  items: readonly ContextPlanItem[];
  planId: string;
  status: "skipped" | "todo";
  tx: TransactionClient;
}) {
  const ids = items.filter((item) => item.status === status).map((item) => item.id);

  return tx.planItem.updateMany({
    data: { completedAt: null, status },
    where: { id: { in: ids }, planId, status: { notIn: ["done", status] } },
  });
}

/**
 * Puts the plan back as the snapshot has it (see `PlanSnapshot`): its state, phases and numbers,
 * and every item on its day with its status, items the change removed included; items the change
 * added leave. Restored items keep their snapshot ids, so today's restored block payloads still
 * reach them. What the learner finished since stays done, and the restored summary counts it (see
 * `reduceRestoredSummary`). `items` are the snapshot's, with what the undo changes about them (a
 * test-out's skipped lessons, todo again).
 */
export async function restorePlan({
  context,
  items,
  snapshot,
  tx,
}: {
  context: PlanContext;
  items: readonly ExistingPlanItem[];
  snapshot: PlanSnapshot;
  tx: TransactionClient;
}): Promise<void> {
  // What stays credited once restored: the snapshot's own finished items, and what the learner
  // finished since, which stays done (see `restoreStatus`); a test-out the undo takes back doesn't.
  const finished = new Set(
    context.items.flatMap((item) => (item.status === "done" ? [item.id] : [])),
  );

  const summary = reduceRestoredSummary({
    completed: items.filter(
      (item) => finished.has(item.id) || item.status === "done" || item.status === "testedOut",
    ),
    planVersion: context.plan.version + 1,
    summary: snapshot.summary,
  });

  await writePlan({
    context,
    plan: {
      coveredShare: summary
        ? (summary.selected.coverage?.coveredShare ?? null)
        : snapshot.coveredShare,
      estimateHours: snapshot.estimateHours,
      inputsKey: snapshot.inputsKey,
      items: items.map(({ position: _position, ...item }) => item),
      phases: snapshot.phases,
      sourceSkillIds: snapshot.sourceSkillIds,
      standInLessons: getSnapshotStandInLessons(snapshot),
      state: snapshot.state,
      summary,
    },
    tx,
  });

  await restoreStatus({ items, planId: context.plan.id, status: "todo", tx });
  await restoreStatus({ items, planId: context.plan.id, status: "skipped", tx });
}
