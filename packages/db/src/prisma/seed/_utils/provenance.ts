/** Keeps hand-written seed content apart from model output in per-model quality reads. */
export const SEED_PROVENANCE = {
  model: "zoonk/hand-written",
  // Stored on seeded rows, and re-seeding tells its steps from generated ones by `runId`, so both keep their first values.
  promptVersion: "seed-v2",
  runId: "seed-v2",
} as const;
