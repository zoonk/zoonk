import "server-only";
import { prisma } from "@zoonk/db";
import { markLearnerChanged, markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { PlanConflictError } from "../../plans/_utils/write-plan";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlannedStudyDay } from "./plan-study-day";
import { prepareSelectedPlanSave, saveSelectedPlan } from "./save-selected-plan";
import { type SelectedDayPlan } from "./selected-day-plan";
import { isSelectedPlanCurrent } from "./selected-plan-current";
import { type SessionDayContext } from "./session-placement";

/** A duplicate open and an input race roll back their early revision, not just their domain rows. */
class StudyDayUnchangedError extends Error {
  override name = "StudyDayUnchangedError";
  readonly status: "exists" | "stale";
  constructor(status: "exists" | "stale") {
    super(status);
    this.status = status;
  }
}

/** The plan, its summary and notice, the day and bound block IDs commit as one writer. */
export async function persistStudyDay({
  context: day,
  planned,
  selection,
}: {
  context: SessionDayContext;
  planned: PlannedStudyDay;
  selection: SelectedDayPlan;
}): Promise<{ status: "created"; sessionId: string } | { status: "exists" | "stale" }> {
  const key = { goalId: day.goal.id, localDate: day.localDate, userId: day.userId };

  const persistsPlan =
    planned.blocks.length > 0 ||
    selection.computed !== null ||
    selection.inputKeyUpdate !== undefined;

  const prepared = prepareSelectedPlanSave({ selection, shown: persistsPlan });

  try {
    return await prisma.$transaction(async (tx) => {
      if (persistsPlan) {
        await markPlansChanged(tx, { planIds: [selection.context.plan.id] });
      } else {
        await markLearnerChanged(tx, { userId: day.userId });
      }

      const exists = await tx.studySession.findUnique({
        select: { id: true },
        where: { userGoalDate: key },
      });

      if (exists) {
        throw new StudyDayUnchangedError("exists");
      }

      if (!(await isSelectedPlanCurrent({ increment: Number(persistsPlan), selection, tx }))) {
        throw new StudyDayUnchangedError("stale");
      }

      const planVersion = await saveSelectedPlan({ context: selection.context, prepared, tx });
      const rows = await tx.planItem.findMany({ where: { planId: selection.context.plan.id } });
      const ids = new Map(rows.map((item) => [getItemKey(item), item.id]));

      const { count } = await tx.studySession.createMany({
        data: [
          {
            ...key,
            freshStart: planned.input.freshStart,
            missions: planned.missions,
            planVersion,
            plannedMinutes: planned.plannedMinutes,
          },
        ],
        skipDuplicates: true,
      });

      if (count === 0) {
        throw new StudyDayUnchangedError("exists");
      }

      const session = await tx.studySession.findUniqueOrThrow({
        select: { id: true },
        where: { userGoalDate: key },
      });

      await tx.studySessionBlock.createMany({
        data: planned.blocks.map((block, position) => {
          const id = block.payload.planItemKey
            ? ids.get(block.payload.planItemKey)
            : block.payload.planItemId;

          if (block.payload.planItemKey && !id) {
            throw new StudyDayUnchangedError("stale");
          }

          return {
            ...block,
            payload: { ...block.payload, planItemId: id ?? null },
            position,
            sessionId: session.id,
          };
        }),
      });

      return { sessionId: session.id, status: "created" };
    });
  } catch (error) {
    if (error instanceof StudyDayUnchangedError) {
      return { status: error.status };
    }

    if (error instanceof PlanConflictError) {
      return { status: "stale" };
    }

    throw error;
  }
}
