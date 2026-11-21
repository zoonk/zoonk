import { type BuiltPlan } from "./build-plan";
import { listReleasedEnds } from "./phase-dates-move";
import {
  type EffectItem,
  type PlanEffect,
  getFittedStandInLessons,
  getSeenChange,
} from "./plan-effect";
import { type PlanGraph, type PlanPhase, type PlanSettings } from "./plan-state";

type SavedEffectItem = EffectItem & { lessons?: number | null; titleSnapshot: string };

export function withBuiltSettings({
  built,
  settings,
  writtenSkillIds,
}: {
  built: {
    checkpointOverflow: PlanSettings["checkpointOverflow"];
    mockFunding: PlanSettings["mockFunding"];
    writingSchedule?: PlanSettings["writingSchedule"];
  };
  settings: PlanSettings;
  writtenSkillIds?: string[];
}): PlanSettings {
  const { writingSchedule: _previous, ...retained } = settings;

  return {
    ...retained,
    checkpointOverflow: built.checkpointOverflow,
    mockFunding: built.mockFunding,
    ...(built.writingSchedule && { writingSchedule: built.writingSchedule }),
    ...(writtenSkillIds && { writtenSkillIds }),
  };
}

export function getRunEffect({
  built,
  context,
  graph,
  kept,
  standInLessons,
}: {
  built: Pick<BuiltPlan, "items" | "phases" | "skillMinutes">;
  context: { items: readonly SavedEffectItem[]; phases: readonly PlanPhase[] };
  graph: PlanGraph;
  kept: ReadonlyMap<number, Date> | undefined;
  standInLessons: ReadonlyMap<string, number>;
}): PlanEffect {
  const fitted = getFittedStandInLessons({ skillMinutes: built.skillMinutes, standInLessons });

  const sizeOf = (item: { lessonId: string | null; skillId: string | null }) =>
    item.lessonId ? 1 : (fitted.get(item.skillId ?? "") ?? 1);

  const effect = getSeenChange({
    after: built.items,
    before: context.items,
    graph,
    lessonsAfter: sizeOf,
    lessonsBefore: (item) => (item.lessonId ? 1 : (item.lessons ?? sizeOf(item))),
  });

  const released = listReleasedEnds({ after: built.phases, kept, shown: context.phases });
  return released.length > 0 ? { ...effect, phaseEnds: released } : effect;
}
