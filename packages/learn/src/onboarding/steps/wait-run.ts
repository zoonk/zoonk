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

/** The run's plan exists, so what waits on it can ask now instead of at its next check. */
export function isPlanMade(run: GenerationRun | null): boolean {
  return run?.steps.createPlan === "completed";
}

export function isPlanBuilding(run: GenerationRun | null): boolean {
  return (
    run !== null && run.status !== "ready" && Object.keys(run.steps).length > 0 && !isPlanMade(run)
  );
}

type PlanGate = { last: { readingNotice: boolean; ready: boolean } | null; status: PollStatus };

/**
 * Until the plan's first answer, the run as the step opened decides, so a reload's replayed steps
 * never switch the screen. A run that's done leaves the time question to say the plan is still
 * working the time out.
 */
export function waitsForPlan({
  gate,
  openedBuilding,
  run,
}: {
  gate: PlanGate;
  openedBuilding: boolean;
  run: GenerationRun | null;
}) {
  const { last } = gate;

  if (last === null) {
    return gate.status === "polling" && openedBuilding;
  }

  return !last.ready && (last.readingNotice || run?.status !== "ready");
}

export function hasWaitFailed({
  poll,
  run,
}: {
  poll: PollStatus;
  run: GenerationRun | null;
}): boolean {
  return poll === "failed" || poll === "timedOut" || isRunStopped(run);
}
