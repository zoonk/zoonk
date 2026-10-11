import { vi } from "vitest";
import { loadPlannerInputs } from "../../_utils/planner-inputs";

/** Each goal's known skills as the planner last read them. */
const plannedKnown = new Map<string, readonly string[]>();

/**
 * Watches the planner's reads of the learner (`loadPlannerInputs`), so the checks rank by the
 * skills the learner showed they know as the plan's last run read them: answers after that run
 * count from the next one, as the pure tier's plans carry them (`SimPlan.knownSkillIds`).
 */
export async function watchPlannerReads() {
  if (vi.isMockFunction(loadPlannerInputs)) {
    return;
  }

  const load = loadPlannerInputs;
  const plannerInputs = await import("../../_utils/planner-inputs");

  vi.spyOn(plannerInputs, "loadPlannerInputs").mockImplementation(async (input) => {
    const loaded = await load(input);
    plannedKnown.set(input.goal.id, [...loaded.knownSkillIds]);
    return loaded;
  });
}

/** An undo brings a plan back as it was built: with the known skills that run read. */
export function keepPlannedKnown({
  goalId,
  knownSkillIds,
}: {
  goalId: string;
  knownSkillIds: readonly string[];
}) {
  plannedKnown.set(goalId, knownSkillIds);
}

/**
 * The known skills the planner last read for a goal (none before its first run). It drops the
 * calls the spy recorded so far: their inputs hold every lesson, and a large run makes thousands.
 */
export function readPlannedKnown(goalId: string): readonly string[] {
  if (vi.isMockFunction(loadPlannerInputs)) {
    vi.mocked(loadPlannerInputs).mockClear();
  }

  return plannedKnown.get(goalId) ?? [];
}
