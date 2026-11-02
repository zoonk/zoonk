import "server-only";
import { prisma } from "@zoonk/db";
import { getNoticeWaitState } from "../notice-wait";
import { type PlanReadiness } from "../time-advice-contract";

type PlanReadinessRow = { built: boolean; noticeWaitUntil: Date | null; owesPlacement: boolean };

/**
 * Placement and the notice's reading each change the time the plan needs, so it can't answer the
 * time question before them. Call it only after checking the goal is the learner's.
 */
export async function readPlanReadiness(goalId: string): Promise<PlanReadiness | null> {
  const [plan] = await prisma.$queryRaw<PlanReadinessRow[]>`
    SELECT
      COALESCE(phases <> '[]'::jsonb AND graph -> 'skills' <> '[]'::jsonb, false) AS built,
      'placement'::"PlanSetupTask" = ANY(setup_tasks) AS "owesPlacement",
      notice_wait_until AS "noticeWaitUntil"
    FROM plans WHERE goal_id = ${goalId}::uuid`;

  if (!plan) {
    return null;
  }

  const readingNotice =
    getNoticeWaitState({ noticeWaitUntil: plan.noticeWaitUntil, now: new Date() }) === "reading";

  return { readingNotice, ready: plan.built && !plan.owesPlacement && !readingNotice };
}
