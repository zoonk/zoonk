import "server-only";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

/**
 * The plan a new day's settling of what earlier days left lays out: the work comes first, the
 * phase ends the learner saw stay, and what no longer fits is set aside. After a day the learner
 * missed, an end whose challenge would come before lessons it tests (see `listEndsBeforeLessons`)
 * moves instead, with each later end that would then come before its own phase's lessons, as
 * little as those lessons need: a missed day may move phase ends (R6), and a challenge never
 * tests what the learner wasn't taught yet. Held on the end a career learner saw, a phase's
 * challenge came before its 13 lessons a missed day left.
 */
export async function computeSettledPlan({
  context,
  missed,
  pace,
}: {
  context: PlanContext;
  /** The learner didn't study on the last day they opened Today (see `wasLastDayStudied`). */
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
