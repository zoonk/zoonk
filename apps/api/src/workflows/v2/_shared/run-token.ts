import { type Hook, createHook, sleep } from "workflow";
import { type Run } from "workflow/api";
import { repeatUntil } from "./repeat-until";
import { readRunState, stopStalledRun } from "./run-activity";

/** How often a run waiting for another checks on it, and for how long: past any run's work. */
const JOIN_POLL = "10s";
const MAX_JOIN_POLLS = 240;

type JoinedState = "completed" | "ended" | "working";

async function stopStalledRunStep(runId: string): Promise<boolean> {
  "use step";

  return stopStalledRun(runId);
}

/** How the joined run stands; one that stalled is stopped here, which ends it. */
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

/** A claimed token: the run holding it, or null when this run does; disposing it lets it go. */
type RunTokenClaim = Disposable & { conflict: Run<unknown> | null };

function toClaim({ conflict, hook }: { conflict: Run<unknown> | null; hook: Hook }): RunTokenClaim {
  return { conflict, [Symbol.dispose]: () => hook.dispose() };
}

/**
 * Claims a token that one run at a time holds (a goal's build, a course's outline, an exam's
 * research): `conflict` is the run holding it, or null when this run holds it now, until the run
 * ends or the claim is disposed (`using`). A run that holds it but stalled (it stopped without
 * ending, as a crash or a server restart leaves it) is stopped first, which frees the token for
 * this run, so nothing joins a run that will never end.
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
 * Waits for the run holding a token by checking on it, instead of waiting on its result alone:
 * its result once it completed, or null when it failed, was cancelled, stalled (stopped here) or
 * is still going after the longest any run's work takes, so the caller does the work itself
 * instead of waiting forever or failing with it.
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
