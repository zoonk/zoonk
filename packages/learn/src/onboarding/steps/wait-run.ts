import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";

/** Before the host knows the goal's run, or when it doesn't follow one. */
export const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

/**
 * The run an onboarding wait shows: the goal's run as the host follows it, or, once checking the
 * server for what the wait needs kept failing or ran too long, a lost connection whose way out
 * checks again.
 */
export function getWaitRun({
  poll,
  run,
}: {
  poll: { restart: () => void; status: PollStatus };
  run: GenerationRun;
}): GenerationRun {
  if (poll.status === "failed" || poll.status === "timedOut") {
    return { ...run, failure: "connection", retry: poll.restart, status: "failed" };
  }

  return run;
}

/** A run that failed or never started waits for its "Try again"; a lost connection doesn't. */
export function isRunStopped(run: GenerationRun | null): boolean {
  return run?.status === "failed" && run.failure !== "connection";
}
