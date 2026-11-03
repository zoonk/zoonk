export type GenerationStepState = "completed" | "started";

/** Milliseconds on the server's clock. */
export type GenerationStepTimes = Partial<Record<GenerationStepState, number>>;

/** `connection`: the updates stopped, though the run may still be working. */
export type GenerationFailure = "connection" | "generation" | "notStarted";

export type GenerationRun = {
  /** This device's clock minus the server's. */
  clockOffsetMs?: number;
  failure: GenerationFailure | null;
  retry?: () => void;
  /** The newest skill the run's skill graph wrote, while it writes them. */
  skillName?: string;
  status: "failed" | "following" | "ready" | "waiting";
  stepTimes?: Partial<Record<string, GenerationStepTimes>>;
  steps: Partial<Record<string, GenerationStepState>>;
  /** The goal's warm-up deck, once the run reports it ready. */
  warmUpId?: string;
};

/** A wait held once ready shows the work as done: every row checked, the clocks stopped, the bar full. */
export function toHeldRun(run: GenerationRun): GenerationRun {
  return { ...run, failure: null, status: "ready" };
}
