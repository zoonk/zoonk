import { type Reached } from "@zoonk/core/sessions/reached";

/** The later level, since Brain Power only goes up, and the higher Energy, since a later count can move it down a little. */
export function mergeReached(earlier: Reached, later: Reached): Reached {
  const energies = [earlier.energy, later.energy].filter((energy) => energy !== null);

  return {
    energy: energies.length > 0 ? Math.max(...energies) : null,
    level: later.level ?? earlier.level,
  };
}
