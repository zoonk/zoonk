import { type Hook, createHook, sleep } from "workflow";
import { type Run } from "workflow/api";
import { repeatUntil } from "./repeat-until";
import { readRunState, stopStalledRun } from "./run-activity";

const JOIN_POLL = "10s";
const MAX_JOIN_POLLS = 240;

type JoinedState = "completed" | "ended" | "working";

async function stopStalledRunStep(runId: string): Promise<boolean> {
  "use step";

  return stopStalledRun(runId);
}

async function checkJoinedRunStep(runId: string): Promise<JoinedState> {
  "use step";

  const { stalled, status } = await readRunState(runId);

  if (stalled) {
    await stopStalledRun(runId);
    return "ended";
  }

  if (status === "completed") {
    return "completed";
  }

  return status === "pending" || status === "running" ? "working" : "ended";
}

type RunTokenClaim = Disposable & { conflict: Run<unknown> | null };

function toClaim({ conflict, hook }: { conflict: Run<unknown> | null; hook: Hook }): RunTokenClaim {
  return { conflict, [Symbol.dispose]: () => hook.dispose() };
}

/**
 * `conflict` is the run holding the token, or null when this run now holds it until it ends or the
 * claim is disposed. A stalled holder is stopped first, so nothing joins a run that will never end.
 */
export async function claimRunToken(token: string): Promise<RunTokenClaim> {
  const hook = createHook({ token });
  const conflict = await hook.getConflict();

  if (!conflict || !(await stopStalledRunStep(conflict.runId))) {
    return toClaim({ conflict, hook });
  }

  const retry = createHook({ token });
  return toClaim({ conflict: await retry.getConflict(), hook: retry });
}

/**
 * Null when the run failed, was cancelled, stalled or outlasted any run's work, so the caller does
 * the work itself instead of waiting forever.
 */
export async function joinRun(run: Run<unknown>): Promise<unknown> {
  const state = await repeatUntil<JoinedState>({
    done: (current) => current !== "working",
    run: () => checkJoinedRunStep(run.runId),
    times: MAX_JOIN_POLLS,
    wait: () => sleep(JOIN_POLL),
  });

  return state === "completed" ? run.returnValue : null;
}
