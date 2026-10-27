import { type Reached } from "@zoonk/core/sessions/reached";

/**
 * What work counted in several goes reached in all (a notebook practice counts its run with each
 * answer, then once more at its end): the latest level, since Brain Power only goes up, and the
 * highest tenth of Energy, since a later count can move it down a little.
 */
export function mergeReached(earlier: Reached, later: Reached): Reached {
  const energies = [earlier.energy, later.energy].filter((energy) => energy !== null);

  return {
    energy: energies.length > 0 ? Math.max(...energies) : null,
    level: later.level ?? earlier.level,
  };
}
