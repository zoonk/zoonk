/**
 * Every Library row stores the run that wrote it. Seed content is written by hand, and saying so
 * keeps it apart from model output in per-model quality reads.
 */
export const SEED_PROVENANCE = {
  model: "zoonk/hand-written",
  promptVersion: "seed-v2",
  runId: "seed-v2",
} as const;
