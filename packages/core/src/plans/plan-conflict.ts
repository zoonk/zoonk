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

/** Inputs must already be durable: a competing plan writer can replace this derived work. */
export async function afterPlanInputWrite<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (isPlanConflictError(error)) {
      return null;
    }

    throw error;
  }
}
