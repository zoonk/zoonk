import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { PlanConflictError } from "../../plans/plan-conflict";
import { getItemKey } from "../../plans/planner/plan-items";
import { getVisibleSessionTotal } from "../session-minutes";
import { hasSameBlocks } from "./day-block-content";
import { withSessionAppendLock } from "./extra-blocks";
import { oweStartedDaySettlements } from "./owe-started-day-settlements";
import { planRestOfDayWithPlan } from "./refresh-day-session";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Append only within the day's remaining time; preserve shown order and never change a finished day. */
export async function appendLandedLessons({
  dropped,
  goal,
  session,
  timeZone,
  selection,
}: Parameters<typeof planRestOfDayWithPlan>[0]["day"] & {
  dropped: StudySessionBlock[];
  selection: SelectedDayPlan;
}): Promise<StudySessionRow> {
  if (session.status === "completed") {
    return session;
  }

  const droppedIds = new Set(dropped.map(({ id }) => id));
  const kept = session.blocks.filter(({ id }) => !droppedIds.has(id));

  const { blocks: lessons, plannedMinutes } = await planRestOfDayWithPlan({
    day: { goal, session, timeZone },
    kept,
    selection,
  });

  const persistsPlan = selection.computed !== null || selection.inputKeyUpdate !== undefined;
  const prepared = await prepareSelectedPlanSave({ selection, shown: persistsPlan });

  const savedVersion = selection.context.plan.version + Number(prepared.kind === "computed");

  await withSessionAppendLock({
    plan: { id: selection.context.plan.id, write: persistsPlan },
    run: async ({ session: locked, transaction }) => {
      if (
        !(await isSelectedPlanCurrent({
          increment: Number(persistsPlan),
          selection,
          tx: transaction,
        }))
      ) {
        throw new PlanConflictError();
      }

      if (
        locked.status === "completed" ||
        !hasSameBlocks({ locked: locked.blocks, read: session.blocks })
      ) {
        return;
      }

      const previousMinutes = getVisibleSessionTotal({
        blocks: locked.blocks,
        planned: locked.plannedMinutes,
        visibleIds: new Set(kept.map(({ id }) => id)),
      });

      await saveSelectedPlan({ context: selection.context, prepared, tx: transaction });

      if (dropped.length > 0) {
        await transaction.studySessionBlock.updateMany({
          data: { estimatedMinutes: null, status: "skipped" },
          where: { id: { in: [...droppedIds] }, sessionId: session.id },
        });
      }

      const items = selection.computed
        ? await transaction.planItem.findMany({ where: { planId: selection.context.plan.id } })
        : selection.context.items;

      const ids = new Map(items.map((item) => [getItemKey(item), item.id]));
      const firstPosition = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

      await transaction.studySessionBlock.createMany({
        data: lessons.map((block, index) => ({
          ...block,
          payload: {
            ...block.payload,
            ...(locked.endedAt && { extra: true }),
            planItemId: block.payload.planItemKey
              ? (ids.get(block.payload.planItemKey) ?? block.payload.planItemId)
              : block.payload.planItemId,
          },
          position: firstPosition + index,
          sessionId: session.id,
        })),
      });

      await transaction.studySession.update({
        data: {
          planVersion: savedVersion,
          plannedMinutes: locked.endedAt
            ? locked.plannedMinutes
            : Math.max(previousMinutes, plannedMinutes),
        },
        where: { id: session.id },
      });

      await oweStartedDaySettlements(transaction, lessons.length > 0 ? [] : dropped);
    },
    session,
  });

  return prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });
}
