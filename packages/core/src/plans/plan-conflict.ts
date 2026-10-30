export class PlanConflictError extends Error {
  constructor() {
    super("The plan changed while it was being planned.");
    this.name = "PlanConflictError";
  }
}

export function isPlanConflictError(error: unknown): boolean {
  return error instanceof PlanConflictError;
}

/** Retries up to twice; run must reload its context. A goal's primary course and researched weights can each land once during onboarding. */
export async function withPlanRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- A retry must reload only after the conflicting attempt finishes.
      return await run();
    } catch (error) {
      if (!(error instanceof PlanConflictError) || attempt >= 2) {
        throw error;
      }
    }
  }
}
