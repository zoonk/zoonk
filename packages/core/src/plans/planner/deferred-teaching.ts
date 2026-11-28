import { type BuiltPlan } from "./built-plan";
import { PLAN_EPSILON } from "./plan-precision";
import { type PlanGraph } from "./plan-state";
import { type DroppedUnit } from "./schedule-units";

export function listDeferredTeaching({
  dropped,
  keptStandInCuts,
}: {
  dropped: readonly DroppedUnit[];
  keptStandInCuts: readonly DroppedUnit[];
}) {
  return [
    ...dropped,
    ...keptStandInCuts.map((unit) => {
      const lessons = unit.lessons ?? 1;

      return {
        ...unit,
        lessons: lessons - Math.round((lessons * unit.fittedMinutes) / unit.minutes),
      };
    }),
  ].filter((unit) => unit.kind === "lesson" && unit.lessons !== 0);
}

export function markLaterPhases<Plan extends BuiltPlan>({
  built,
  graph,
}: {
  built: Plan;
  graph: PlanGraph;
}): Plan {
  const waiting = new Set(
    built.skillMinutes
      .filter(({ covered, total }) => covered < total - PLAN_EPSILON)
      .map(({ skillId }) => skillId),
  );

  const deferred = new Set(built.deferredTeaching?.map((unit) => unit.skillId));

  const later = new Set(
    graph.skills
      .filter(({ skillId }) => waiting.has(skillId) || deferred.has(skillId))
      .map(({ phase }) => phase),
  );

  return {
    ...built,
    phases: built.phases.map((phase, index) =>
      later.has(index) || phase.challengeLeftOut
        ? { ...phase, challengeLeftOut: undefined, endDate: null, later: true }
        : phase,
    ),
  };
}
