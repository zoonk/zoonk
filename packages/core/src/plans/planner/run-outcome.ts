import { type BuiltPlan } from "./build-plan";
import { listReleasedEnds } from "./phase-dates-move";
import { type EffectItem, type PlanEffect, getPlanEffect } from "./plan-effect";
import { type PlanPhase, type PlanSettings } from "./plan-state";

/**
 * The settings a planning run saves: the learner's, with what its build derived for Today and the
 * plan's week to read (its mocks' funding, its checkpoints' overflow).
 */
export function withBuiltSettings({
  built,
  settings,
}: {
  built: {
    checkpointOverflow: PlanSettings["checkpointOverflow"];
    mockFunding: PlanSettings["mockFunding"];
  };
  settings: PlanSettings;
}): PlanSettings {
  return {
    ...settings,
    checkpointOverflow: built.checkpointOverflow,
    mockFunding: built.mockFunding,
  };
}

/**
 * What a run changes in the plan the learner saw (see `getPlanEffect`), with the kept phase ends it
 * moved anyway (see `listReleasedEnds`), when any.
 */
export function getRunEffect({
  built,
  context,
  kept,
  standInLessons,
}: {
  built: Pick<BuiltPlan, "items" | "phases">;
  context: { items: readonly EffectItem[]; phases: readonly PlanPhase[] };
  kept: ReadonlyMap<number, Date> | undefined;
  standInLessons: ReadonlyMap<string, number>;
}): PlanEffect {
  const effect = getPlanEffect({ after: built.items, before: context.items, standInLessons });
  const released = listReleasedEnds({ after: built.phases, kept, shown: context.phases });
  return released.length > 0 ? { ...effect, phaseEnds: released } : effect;
}
