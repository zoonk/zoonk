import { type PlanReadiness } from "@zoonk/core/plans/time-advice-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationFailure, type GenerationRun } from "../../generation/generation-run";

export const WAITING_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

type Poll = { restart: () => void; status: PollStatus };

function hasPollStopped(status: PollStatus): boolean {
  return status === "failed" || status === "timedOut";
}

export function getWaitRun({ poll, run }: { poll: Poll; run: GenerationRun }): GenerationRun {
  if (hasPollStopped(poll.status)) {
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

export type WaitStop = { failure: GenerationFailure; retry?: () => void };

/**
 * The notice is read apart from the run, so its wait stops when its own answers stop coming or the
 * run stopped, not when the run's updates do.
 */
export function getNoticeStop({
  poll,
  run,
}: {
  poll: Poll;
  run: GenerationRun | null;
}): WaitStop | null {
  if (hasPollStopped(poll.status)) {
    return { failure: "connection", retry: poll.restart };
  }

  return run && isRunStopped(run)
    ? { failure: run.failure ?? "generation", retry: run.retry }
    : null;
}

export type PlanWaitScreen = "building" | "notice";

type PlanGate = { last: PlanReadiness | null };

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

  return readingNotice ? "notice" : "building";
}

export function getRevealWait(
  plan: Pick<PlanView, "notice" | "ready"> | null,
): PlanWaitScreen | null {
  if (!plan?.ready) {
    return "building";
  }

  return plan.notice === "reading" ? "notice" : null;
}
