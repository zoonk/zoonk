import { vi } from "vitest";
import { loadPaceSamples } from "../_utils/pace-samples";

/**
 * Everyone's pace and others' pace on the plan's lessons are the learner's own. The real read takes
 * every learner's lessons of the month before the plan's day from the whole test database, where
 * other files finish lessons on any day, so a test would plan at a pace that depends on them.
 */
export async function keepPaceOwn() {
  if (vi.isMockFunction(loadPaceSamples)) {
    return;
  }

  const load = loadPaceSamples;
  const paceSamples = await import("../_utils/pace-samples");

  vi.spyOn(paceSamples, "loadPaceSamples").mockImplementation(async (input) => {
    const { own } = await load(input);
    return { course: null, own, typical: own };
  });
}
