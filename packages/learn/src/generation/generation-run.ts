/** How far the run reported a step: it began, or it finished. */
export type GenerationStepState = "completed" | "started";

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
  failure: GenerationFailure | null;
  /**
   * The learner's way out of a failure: follows the same run again after a lost connection, or
   * starts it again (a request the learner makes by tapping) after it failed or didn't start.
   */
  retry?: () => void;
  status: "failed" | "following" | "ready" | "waiting";
  /** The latest state of each step the run reported, by step name. */
  steps: Partial<Record<string, GenerationStepState>>;
};
