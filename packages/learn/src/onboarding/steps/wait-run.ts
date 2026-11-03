import { type PlanReadiness } from "@zoonk/core/plans/time-advice-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
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

export function hasWaitFailed({
  poll,
  run,
}: {
  poll: PollStatus;
  run: GenerationRun | null;
}): boolean {
  return poll === "failed" || poll === "timedOut" || isRunStopped(run);
}

export type PlanWaitScreen = "building" | "notice";

type PlanGate = { last: PlanReadiness | null; status: PollStatus };

/**
 * Until the plan's first answer, the onboarding view's word as the step opened decides. After it, a
 * run that's done leaves the time question to say the plan is still working the time out.
 */
export function getPlanWait({
  gate,
  opened,
  run,
}: {
  gate: PlanGate;
  opened: PlanReadiness;
  run: GenerationRun | null;
}): PlanWaitScreen | null {
  const { last } = gate;
  const { readingNotice, ready } = last ?? opened;

  if (ready || (last && !readingNotice && run?.status === "ready")) {
    return null;
  }

  return readingNotice && !hasWaitFailed({ poll: gate.status, run }) ? "notice" : "building";
}

/** A notice wait that stopped shows the plan's wait instead, which offers to try again. */
export function getRevealWait({
  plan,
  poll,
  run,
}: {
  plan: Pick<PlanView, "notice" | "ready"> | null;
  poll: PollStatus;
  run: GenerationRun | null;
}): PlanWaitScreen | null {
  if (!plan?.ready) {
    return "building";
  }

  if (plan.notice !== "reading") {
    return null;
  }

  return hasWaitFailed({ poll, run }) ? "building" : "notice";
}
