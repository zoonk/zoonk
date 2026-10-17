/** How far the run reported a step: it began, or it finished. */
export type GenerationStepState = "completed" | "started";

/** When the run reported a step began and finished, in milliseconds on the server's clock. */
export type GenerationStepTimes = Partial<Record<GenerationStepState, number>>;

/**
 * Why a wait stopped: the run never appeared (`notStarted`), the updates stopped coming although
 * the run may still be working (`connection`), or the run itself failed (`generation`).
 */
export type GenerationFailure = "connection" | "generation" | "notStarted";

/**
 * A generation run as the host follows it: `waiting` until the run is known, `following` while it
 * reports steps, then `ready` or `failed`. Hosts on every platform fill it from the run's step
 * stream; the waits only show it.
 */
export type GenerationRun = {
  /**
   * This device's clock minus the server's (`stepTimes`), to time the phase running now. Hosts
   * whose runs report no times leave both out, and the wait shows no times.
   */
  clockOffsetMs?: number;
  failure: GenerationFailure | null;
  /**
   * The learner's way out of a failure: follows the same run again after a lost connection, or
   * starts it again (a request the learner makes by tapping) after it failed or didn't start.
   */
  retry?: () => void;
  status: "failed" | "following" | "ready" | "waiting";
  /** When the run reported each step, by step name, so the wait says how long each phase took. */
  stepTimes?: Partial<Record<string, GenerationStepTimes>>;
  /** The latest state of each step the run reported, by step name. */
  steps: Partial<Record<string, GenerationStepState>>;
};
