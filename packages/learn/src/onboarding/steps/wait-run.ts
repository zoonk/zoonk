import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";

export const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

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
