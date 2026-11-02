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
  status: "failed" | "following" | "ready" | "waiting";
  stepTimes?: Partial<Record<string, GenerationStepTimes>>;
  steps: Partial<Record<string, GenerationStepState>>;
};
