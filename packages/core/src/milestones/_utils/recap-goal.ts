import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanPhases } from "../../plans/planner/plan-state";

/**
 * The goal's phases finished within the week ("Phase 1 · Basics done"): every item of the phase
 * is done and the last one was finished in the week.
 */
export async function loadPhasesFinished({
  from,
  goalId,
  to,
}: {
  from: Date;
  goalId: string;
  to: Date;
}): Promise<{ name: string; phase: number }[]> {
  const plan = await prisma.plan.findUnique({
    include: { items: { select: { completedAt: true, phase: true, status: true } } },
    where: { goalId },
  });

  if (!plan) {
    return [];
  }

  const names = parsePlanPhases(plan.phases);
  const phases = [...new Set(plan.items.map((item) => item.phase))].toSorted((a, b) => a - b);

  return phases.flatMap((phase) => {
    const items = plan.items.filter((item) => item.phase === phase);
    const lastDone = Math.max(...items.map((item) => item.completedAt?.getTime() ?? 0));
    const finished = items.every((item) => item.status !== "todo");

    return finished && lastDone >= from.getTime() && lastDone < to.getTime()
      ? [{ name: names[phase]?.name ?? "", phase }]
      : [];
  });
}
