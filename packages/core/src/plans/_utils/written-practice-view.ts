import { type Goal } from "@zoonk/db";
import { getWrittenTestAreas } from "../planner/graph-areas";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { isShortExam } from "../planner/short-exam-plan";
import { getEffectiveCadence, getFinalWeeksStart } from "../planner/written-cadence";
import { type WrittenPractice } from "../written-practice-contract";

function getPlanStart({ createdAt, settings }: { createdAt: Date; settings: PlanSettings }) {
  return settings.startDate ? fromIsoDate(settings.startDate) : fromIsoDate(toIsoDate(createdAt));
}

export function getWrittenPracticeView({
  goal,
  graph,
  settings,
}: {
  goal: Pick<Goal, "createdAt" | "kind" | "targetDate">;
  graph: PlanGraph;
  settings: PlanSettings;
}): WrittenPractice | null {
  const parts = [...getWrittenTestAreas(graph)];
  const { targetDate } = goal;
  const planStart = getPlanStart({ createdAt: goal.createdAt, settings });

  if (
    goal.kind !== "exam" ||
    parts.length === 0 ||
    (targetDate && isShortExam({ planStart, targetDate }))
  ) {
    return null;
  }

  const schedule = { cadence: settings.writtenCadence, planStart, targetDate };

  const hasFinalWeeks =
    targetDate !== null &&
    getEffectiveCadence({ ...schedule, cadence: "finalWeeks" }) === "finalWeeks";

  return {
    cadence: getEffectiveCadence(schedule),
    finalWeeksFrom: hasFinalWeeks ? toIsoDate(getFinalWeeksStart({ planStart, targetDate })) : null,
    parts,
  };
}
