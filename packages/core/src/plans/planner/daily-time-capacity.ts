import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { hasBaseChoices } from "./chosen-bases";
import { type StudyScheduleAt, withDailyMinutes } from "./daily-time-plans";
import { createDays, getPlanStart, listFundedPlanDays } from "./plan-run-days";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";
import { getCumulativeCapacity } from "./schedule-units";
import { type SizedPlanInput } from "./sized-plan";

const EPSILON = 1e-6;

/** The same calendar capacity the planner uses, before any carried work reserves time. */
function getCapacity(given: BuildPlanInput): number {
  // Without the exam's phase challenges, which go wherever their lessons end (see
  // `placeExamBosses`): the bound never counts time a placement may leave to lessons.
  const input = { ...given, bossDays: new Map() };
  const days = createDays({ input, planStart: getPlanStart(input) });

  // The plan's mocks take their time from the days before them, as the plan lays them out.
  const planDays = listFundedPlanDays({ days, input }).days;

  return getCumulativeCapacity(planDays).at(-1) ?? 0;
}

/**
 * A necessary bound for the graph-sized search: with no saved items or outlined lessons, total
 * pending lesson minutes do not depend on daily time. Nonessential base choices follow another
 * plan's order, so defer those to the full planner. A single lesson may exceed all capacity and
 * still be put on day one (`getDueDay`), so defer that case too. Passing the bound never proves
 * feasibility: the real planner still evaluates the candidate, including its mock cadence.
 */
export function mayFitInDepthAtMinutes({
  built,
  sized,
  studyScheduleAt,
}: {
  built: BuiltPlan;
  sized: SizedPlanInput;
  studyScheduleAt?: StudyScheduleAt;
}): (dailyMinutes: number) => boolean {
  const { input } = sized;
  const needed = built.skillMinutes.reduce((total, skill) => total + skill.total, 0);

  if (hasBaseChoices(input) || needed <= DEFAULT_LESSON_MINUTES * input.paceFactor + EPSILON) {
    return () => true;
  }

  return (minutes) =>
    getCapacity(withDailyMinutes(input, minutes, studyScheduleAt)) + EPSILON >= needed;
}
