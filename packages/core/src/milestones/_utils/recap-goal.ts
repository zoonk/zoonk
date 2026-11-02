import "server-only";
import { prisma } from "@zoonk/db";
import { isPhaseFinished } from "../../plans/_utils/phase-states";
import { parsePlanPhases } from "../../plans/planner/plan-state";

/** A phase finishes only when all work is completed, not set aside. */
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
    include: { items: { select: { completedAt: true, kind: true, phase: true, status: true } } },
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

    const finished =
      !names[phase]?.challengeLeftOut &&
      items.every((item) => item.status !== "todo") &&
      isPhaseFinished(items);

    return finished && lastDone >= from.getTime() && lastDone < to.getTime()
      ? [{ name: names[phase]?.name ?? "", phase }]
      : [];
  });
}
