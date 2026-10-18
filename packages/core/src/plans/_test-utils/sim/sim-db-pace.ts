import { vi } from "vitest";
import { loadPaceSamples } from "../../_utils/pace-samples";

/**
 * Others aren't simulated: everyone's pace and others' pace on the plan's lessons are the
 * learner's own, as in the pure tier (`sim-planner.ts`). The real read takes every learner's
 * lessons of the month before the plan's day from the whole test database, where other files and
 * lives finish lessons on any day, so a life would plan at a pace the pure tier never sees.
 */
export async function keepPaceOwn() {
  if (vi.isMockFunction(loadPaceSamples)) {
    return;
  }

  const load = loadPaceSamples;
  const paceSamples = await import("../../_utils/pace-samples");

  vi.spyOn(paceSamples, "loadPaceSamples").mockImplementation(async (input) => {
    const { own } = await load(input);
    return { course: null, own, typical: own };
  });
}
