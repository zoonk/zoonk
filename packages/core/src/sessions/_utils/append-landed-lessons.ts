import "server-only";
import { prisma } from "@zoonk/db";
import { PlanConflictError } from "../../plans/plan-conflict";
import { getItemKey } from "../../plans/planner/plan-items";
import { withSessionAppendLock } from "./extra-blocks";
import { hasSameBlocks, planRestOfDay } from "./refresh-day-session";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Append only within the day's remaining time; preserve shown order and never change a finished day. */
export async function appendLandedLessons({
  goal,
  session,
  timeZone,
  selection,
}: Parameters<typeof planRestOfDay>[0]["day"] & {
  selection: SelectedDayPlan;
}): Promise<StudySessionRow> {
  if (session.status === "completed") {
    return session;
  }

  const lessons = await planRestOfDay({
    day: { goal, session, timeZone },
    kept: session.blocks,
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

      await saveSelectedPlan({ context: selection.context, prepared, tx: transaction });

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
          plannedMinutes:
            session.blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0) +
            lessons.reduce((sum, block) => sum + block.estimatedMinutes, 0),
        },
        where: { id: session.id },
      });
    },
    session,
  });

  return prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: session.id },
  });
}
