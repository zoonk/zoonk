import { type TransactionClient } from "@zoonk/db";
import { applyCourseStart } from "../../learner/placement/_utils/course-start-items";
import { loadCourseStarts } from "./course-starts";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext, loadPlanContext } from "./plan-context";
import { savePlanSnapshot } from "./plan-snapshot";
import { type SavedPlanItem } from "./save-plan-items";

export async function applyStartsToNewLessons({
  context,
  items,
  tx,
}: {
  context: PlanContext;
  items: readonly SavedPlanItem[];
  tx: TransactionClient;
}) {
  const existing = new Set(context.items.map((item) => item.id));

  if (
    !items.some(
      (item) =>
        item.kind === "lesson" && item.status === "todo" && !(item.id && existing.has(item.id)),
    )
  ) {
    return;
  }

  const starts = await loadCourseStarts(context.goal.id, tx);
  const byChange = Map.groupBy([...starts], ([, start]) => start.changeId);

  for (const [changeId, entries] of byChange) {
    const start = entries[0]?.[1];

    if (start) {
      // oxlint-disable-next-line no-await-in-loop -- Each receipt and its items share the plan transaction.
      await applyNewLessons({
        at: start.at,
        changeId,
        context,
        existing,
        skillIds: entries.map(([id]) => id),
        tx,
      });
    }
  }
}

async function applyNewLessons({
  context,
  existing,
  changeId,
  at,
  skillIds,
  tx,
}: {
  context: PlanContext;
  existing: Set<string>;
  changeId: string;
  at: Date;
  skillIds: string[];
  tx: TransactionClient;
}) {
  const change = await tx.planChange.findUniqueOrThrow({
    select: { payload: true },
    where: { id: changeId },
  });

  const payload = parsePlanChangePayload(change.payload);

  const applied = await applyCourseStart({
    exceptIds: [...existing],
    goalId: context.goal.id,
    lineSkillIds: payload.lineSkillIds,
    now: at,
    startedPastSkillIds: skillIds,
    tx,
  });

  if (applied.testedOutPlanItemIds.length === 0) {
    return;
  }

  const versionAfter = context.plan.version + 1;

  const canUndo =
    payload.versionAfter === context.plan.version || payload.versionAfter === versionAfter;

  const planItemIds = [...payload.planItemIds, ...applied.testedOutPlanItemIds];
  const lessonsSkipped = (payload.lessonsSkipped ?? 0) + applied.partLessonsSkipped;

  await tx.planChange.update({
    data: {
      payload: toPlanChangePayload({
        ...payload,
        lessonsSkipped,
        planItemIds,
        ...(canUndo && { versionAfter }),
      }),
    },
    where: { id: changeId },
  });

  if (canUndo) {
    const updated = await loadPlanContext({
      db: tx,
      goal: context.goal,
      timeZone: context.timeZone,
    });

    if (updated) {
      await tx.planChangeSnapshot.deleteMany({ where: { changeId } });
      await savePlanSnapshot({ changeId, context: updated, tx });
    }
  }
}
