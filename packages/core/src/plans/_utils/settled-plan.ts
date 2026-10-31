import "server-only";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

export async function computeSettledPlan({
  context,
  missed,
  pace,
}: {
  context: PlanContext;
  missed: boolean;
  pace: "sampled" | "saved";
}): Promise<ComputedPlan> {
  const settle = async (released: ReadonlySet<number>): Promise<ComputedPlan> => {
    const computed = await computePlan({
      context,
      keepPhaseDates: true,
      mode: "forced",
      pace,
      releasedPhases: released,
      setAsideLeftWork: true,
    });

    const more = missed
      ? computed.built.endsBeforeLessons.filter((phase) => !released.has(phase))
      : [];

    return more.length > 0 ? settle(new Set([...released, ...more])) : computed;
  };

  return settle(new Set());
}
