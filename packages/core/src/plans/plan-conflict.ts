export class PlanConflictError extends Error {
  constructor() {
    super("The plan changed while it was being planned.");
    this.name = "PlanConflictError";
  }
}

export function isPlanConflictError(error: unknown): boolean {
  return error instanceof PlanConflictError;
}

/** Retries `run` once when another run commits first; `run` must reload its context. */
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

/**
 * Null when another plan writer won, which saves nothing: fine for derived work once its inputs are
 * durable, since that writer replaces it, and for a learner's request they can send again.
 */
export async function unlessPlanConflict<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (isPlanConflictError(error)) {
      return null;
    }

    throw error;
  }
}
