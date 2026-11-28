import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { owePlanStartLessons } from "../follow-ups/owe-goal-lessons";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { listChangeTopics } from "./_utils/living-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanContext } from "./_utils/plan-context";
import { savePlanSnapshot } from "./_utils/plan-snapshot";
import { countLessons } from "./_utils/stand-in-lessons";

type Input = {
  goalId: string;
  itemIds: readonly string[];
  now: Date;
  receipt: string;
  lineSkillIds?: readonly string[];
  startedPastSkillIds?: readonly string[];
  timeZone: string;
  tx: TransactionClient;
  userId: string;
};

/** Call under the learner and plan locks, in the same write that tested out the items. */
export async function recordTestOutChange(input: Input): Promise<void> {
  const { goalId, itemIds, now, receipt, timeZone, tx, userId } = input;

  const starts = input.startedPastSkillIds;

  if (itemIds.length === 0 && !starts?.length) {
    return;
  }

  const goals = await tx.goal.findMany({
    where: starts?.length
      ? { id: goalId, userId }
      : { plan: { items: { some: { id: { in: [...itemIds] }, status: "testedOut" } } }, userId },
  });

  const skipped = new Set(itemIds);

  await Promise.all(
    goals.map(async (goal) => {
      const context = await loadPlanContext({
        db: tx,
        goal,
        now,
        timeZone: goal.id === goalId ? timeZone : null,
      });

      if (!context) {
        return;
      }

      const items = context.items.filter(
        ({ id, status }) => skipped.has(id) && status === "testedOut",
      );

      const versionAfter = context.plan.version + 1;

      const lessonsSkipped = countLessons(
        starts ? items.filter((item) => item.kind === "lesson") : items,
      );

      const topicsLeftOut = listChangeTopics({
        graph: context.state.graph,
        skillIds: new Set(starts ?? items.flatMap(({ skillId }) => skillId ?? [])),
      });

      await tx.plan.update({
        data: { version: versionAfter },
        select: { id: true },
        where: { id: context.plan.id },
      });

      await tx.planChangeSnapshot.deleteMany({ where: { change: { planId: context.plan.id } } });

      const change = await tx.planChange.create({
        data: {
          createdAt: now,
          kind: "testedOut",
          payload: toPlanChangePayload({
            effect: {
              endDateAfter: null,
              endDateBefore: null,
              lessonsAdded: 0,
              lessonsRemoved: lessonsSkipped,
              topicsLeftOut,
            },
            lessonsSkipped,
            planItemIds: items.map(({ id }) => id),
            testReceipt: receipt,
            ...(input.lineSkillIds && { lineSkillIds: [...input.lineSkillIds] }),
            ...(starts && { startedPastSkillIds: [...starts] }),
            todaySession: "unchanged",
            versionAfter,
          }),
          planId: context.plan.id,
          reason: starts
            ? "Your placement test found your starting lesson."
            : "Placement or a test-out skipped lessons the learner already knows.",
          status: "applied",
        },
        select: { id: true },
      });

      // Undo restores tested-out snapshot items named in the change to todo, including new stand-ins.
      await savePlanSnapshot({ changeId: change.id, context, tx });
      await keepOpenSessionSelection(tx, { goalId: goal.id, planVersion: versionAfter });

      if (goal.id !== goalId) {
        await owePlanStartLessons({ db: tx, goalId: goal.id, userId });
      }
    }),
  );
}
