import "server-only";
import { type PlanChange, type Sql, prisma } from "@zoonk/db";

export type PlanChangeRow = Pick<
  PlanChange,
  "createdAt" | "id" | "kind" | "payload" | "reason" | "status"
>;

/** A replan can advance the change's undo version with the plan's version in one commit. */
export function readPlanChanges({
  limit = null,
  planId,
  where,
}: {
  limit?: number | null;
  planId: string;
  where: Sql;
}) {
  return prisma.$queryRaw<(PlanChangeRow & { planVersion: number })[]>`
    SELECT change.id, change.kind, change.status, change.reason, change.payload,
           change.created_at AS "createdAt", plan.version AS "planVersion"
    FROM plan_changes AS change
    JOIN plans AS plan ON plan.id = change.plan_id
    WHERE change.plan_id = ${planId}::uuid AND (${where})
    ORDER BY change.created_at DESC, change.id DESC
    LIMIT ${limit}
  `;
}
