import { vi } from "vitest";
import { loadPaceSamples } from "../_utils/pace-samples";

/**
 * The real read takes every learner's lessons in the shared test database, so other files' lessons
 * would change the pace.
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
