import "server-only";
import { type PlanItem, type TransactionClient, prisma } from "@zoonk/db";

export type PlanItemRow = Pick<
  PlanItem,
  "chapterId" | "id" | "kind" | "lessonId" | "phase" | "skillId" | "status" | "titleSnapshot"
>;

export type GoalPlanSource = {
  graph: unknown;
  items: PlanItemRow[];
  phases: unknown;
  settings: unknown;
};

export function loadSavedGoalPlanSource(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<GoalPlanSource | null> {
  return tx.plan.findUnique({
    select: {
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          chapterId: true,
          id: true,
          kind: true,
          lessonId: true,
          phase: true,
          skillId: true,
          status: true,
          titleSnapshot: true,
        },
      },
      phases: true,
      settings: true,
    },
    where: { goalId },
  });
}
