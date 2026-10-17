import { type Goal } from "@zoonk/db";
import { getWrittenTestAreas } from "../planner/graph-areas";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { isShortExam } from "../planner/short-exam-plan";
import { getEffectiveCadence, getFinalWeeksStart } from "../planner/written-cadence";
import { type WrittenPractice } from "../written-practice-contract";

/**
 * The plan's first day; a plan the planner hasn't run on since it was created (a seeded one) began
 * the day its goal was created.
 */
function getPlanStart({ createdAt, settings }: { createdAt: Date; settings: PlanSettings }) {
  return settings.startDate ? fromIsoDate(settings.startDate) : fromIsoDate(toIsoDate(createdAt));
}

/**
 * When the plan's written tests are practiced, as the learner chooses it (see `WRITTEN_CADENCES`):
 * the cadence that applies, their names, and the first day of the final weeks when that choice
 * applies. Null without written tests, and for a test days away, whose few days need them all.
 */
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
