/** Another planning run committed first; the caller reloads and tries again. */
export class PlanConflictError extends Error {
  constructor() {
    super("The plan changed while it was being planned.");
    this.name = "PlanConflictError";
  }
}

/**
 * Whether a plan write lost to another write of the same plan, or to a change of what it was
 * planned from, after its own retry: planning again later, from the plan as it is then, saves it.
 */
export function isPlanConflictError(error: unknown): boolean {
  return error instanceof PlanConflictError;
}

/**
 * Runs a planning step that reloads its context: when another run commits first, it starts over
 * once from the new plan instead of overwriting it.
 */
export async function withPlanRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PlanConflictError) {
      return run();
    }

    throw error;
  }
}
