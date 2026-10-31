import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import { getFinalStretchStart } from "./final-stretch-rules";

export async function loadFinalStretchStart(goalId: string | null): Promise<Date | null> {
  const plan = goalId
    ? await prisma.plan.findUnique({ select: { phases: true }, where: { goalId } })
    : null;

  return getFinalStretchStart(parsePlanPhases(plan?.phases));
}
