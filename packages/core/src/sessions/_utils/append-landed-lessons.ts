import "server-only";
import { prisma } from "@zoonk/db";
import { PlanConflictError } from "../../plans/plan-conflict";
import { getItemKey } from "../../plans/planner/plan-items";
import { AWAITING_OUTLINES_VERSION, loadDayPlanVersion } from "./day-plan-version";
import { withSessionAppendLock } from "./extra-blocks";
import { hasSameBlocks, planRestOfDay } from "./refresh-day-session";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * A day opened while it held time for lessons still being outlined (its plan version says so, see
 * `loadDayPlanVersion`): once they land, or nobody is writing them anymore, the learner's next Open
 * or Continue adds the new lessons to its end, up to the day's time, without moving anything they
 * were shown, as Today's "more as you go" said. A finished day stays as it is. Returns the day as
 * it is now.
 */
export async function appendLandedLessons({
  goal,
  session,
  timeZone,
  selection,
}: Parameters<typeof planRestOfDay>[0]["day"] & {
  selection?: SelectedDayPlan;
}): Promise<StudySessionRow> {
  if (
    (!selection && session.planVersion !== AWAITING_OUTLINES_VERSION) ||
    session.status === "completed"
  ) {
    return session;
  }

  const planVersion = await loadDayPlanVersion({
    goal,
    localDate: session.localDate,
    plan: selection && { graph: selection.state.graph, version: selection.context.plan.version },
  });

  if (!selection && planVersion === AWAITING_OUTLINES_VERSION) {
    return session;
  }

  const planned = await planRestOfDay({
    day: { goal, session, timeZone },
    kept: session.blocks,
    selection,
  });

  const lessons = selection ? planned : planned.filter((block) => block.kind === "learn");

  const persistsPlan =
    selection !== undefined &&
    (selection.computed !== null || selection.inputKeyUpdate !== undefined);

  const prepared = selection
    ? await prepareSelectedPlanSave({ selection, shown: persistsPlan })
    : null;

  const savedVersion =
    planVersion === null || planVersion === AWAITING_OUTLINES_VERSION
      ? planVersion
      : planVersion + Number(prepared?.kind === "computed");

  await withSessionAppendLock({
    plan: selection && { id: selection.context.plan.id, write: persistsPlan },
    run: async ({ session: locked, transaction }) => {
      if (
        selection &&
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

      if (selection && prepared) {
        await saveSelectedPlan({ context: selection.context, prepared, tx: transaction });
      }

      const items = selection?.computed
        ? await transaction.planItem.findMany({ where: { planId: selection.context.plan.id } })
        : (selection?.context.items ?? []);

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
