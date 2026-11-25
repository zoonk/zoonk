import "server-only";
import { prisma } from "@zoonk/db";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { readPlanSummary } from "./_utils/plan-summary";
import { searchPlanTime } from "./_utils/plan-time-search";
import { loadPlanAtToken } from "./_utils/plan-token";
import { revalidatePlanTags } from "./_utils/replan";
import { findPlanSuggestion, maySuggestPlanTime } from "./_utils/suggested-time";
import { PlanConflictError } from "./plan-conflict";

export async function refreshPlanSuggestion({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<void> {
  const pending = await prisma.plan.count({
    where: { goalId, summary: { equals: true, path: ["advice", "suggestionPending"] } },
  });

  if (pending === 0) {
    return;
  }

  const context = await loadPlanAtToken(goalId);

  if (context?.goal.userId !== userId || context.goal.status !== "active") {
    return;
  }

  const { goal, plan, today } = context;
  const summary = readPlanSummary({ plan: { ...plan, userId }, value: plan.summary });

  if (!summary?.advice.suggestionPending) {
    return;
  }

  const { dailyMinutes, targetDate } = goal;

  const maySuggest = maySuggestPlanTime({
    dailyMinutes,
    pastDate: targetDate !== null && targetDate < today,
    shown: { ...summary.advice.feasibility, deadline: targetDate },
  });

  const computed = maySuggest ? await searchPlanTime({ context }) : null;

  const suggested =
    computed && findPlanSuggestion({ dailyMinutes, feasibility: computed.feasibility });

  await writePlanMetadata({
    context,
    write: async (tx) => {
      const { count } = await tx.plan.updateMany({
        data: {
          summary: {
            ...summary,
            advice: { ...summary.advice, suggested, suggestionPending: false },
          },
        },
        where: { id: plan.id, sourceVersion: plan.sourceVersion, summary: { equals: summary } },
      });

      if (count === 0) {
        throw new PlanConflictError();
      }
    },
  });

  revalidatePlanTags(userId);
}
