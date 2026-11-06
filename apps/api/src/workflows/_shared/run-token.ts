import { type Hook, createHook, sleep } from "workflow";
import { type Run, start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { repeatUntil } from "./repeat-until";
import { stopStalledRun } from "./run-activity";

const JOIN_POLL = "10s";
const MAX_JOIN_POLLS = 240;

type JoinedState = "completed" | "ended" | "working";

async function stopStalledRunStep(runId: string): Promise<boolean> {
  "use step";

  const { stalled } = await stopStalledRun(runId);
  return stalled;
}

/**
 * A token can name a run that was admitted but never created, because its writer died. Nothing does
 * that run's work, so this throws rather than let a caller treat the work as under way.
 */
async function stopStalledOwnerStep(runId: string): Promise<boolean> {
  "use step";

  const { stalled, status } = await stopStalledRun(runId);

  if (status === null) {
    throw new Error(`The run holding this token can't be read: ${runId}`);
  }

  return stalled;
}

async function checkJoinedRunStep(runId: string): Promise<JoinedState> {
  "use step";

  const { stalled, status } = await stopStalledRun(runId);

  if (stalled) {
    return "ended";
  }

  if (status === "completed") {
    return "completed";
  }

  return status === "pending" || status === "running" ? "working" : "ended";
}

type StartedRun = { runId: string; stopped: boolean };

async function startOrFindHolder<TArgs extends unknown[]>(
  workflow: (...args: TArgs) => Promise<unknown>,
  args: TArgs,
  token: string,
): Promise<StartedRun> {
  try {
    const run = await start(workflow, args, { experimental_hook: { token } });
    return { runId: run.runId, stopped: false };
  } catch (error) {
    if (HookConflictError.is(error) && error.conflictingRunId) {
      const runId = error.conflictingRunId;
      return { runId, stopped: await stopStalledOwnerStep(runId) };
    }

    throw error;
  }
}

/**
 * Starts a run that holds `token` until it ends and returns its id, or the id of the run already
 * holding it, so a duplicate never becomes a run. A stalled holder is stopped and replaced once.
 * Throws when the holder can't be read or the replacement's holder stalled too, so the caller's
 * failure keeps the work for a later start.
 */
export async function startOnce<TArgs extends unknown[]>(
  workflow: (...args: TArgs) => Promise<unknown>,
  args: TArgs,
  token: string,
): Promise<string> {
  const first = await startOrFindHolder(workflow, args, token);

  if (!first.stopped) {
    return first.runId;
  }

  const second = await startOrFindHolder(workflow, args, token);

  if (second.stopped) {
    throw new Error(`The run holding this token stalled again: ${second.runId}`);
  }

  return second.runId;
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
 * Takes the token once its holder ends. Runs waiting on one holder then take turns instead of all
 * resuming together. After `joinRun`'s longest wait the caller goes on without it, as a joined run does.
 */
export async function waitForRunToken(token: string): Promise<void> {
  await repeatUntil({
    done: (claim) => claim.conflict === null,
    run: () => claimRunToken(token),
    times: MAX_JOIN_POLLS,
    wait: () => sleep(JOIN_POLL),
  });
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
