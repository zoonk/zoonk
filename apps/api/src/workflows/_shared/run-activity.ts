import { safeAsync } from "@zoonk/utils/error";
import { getRun } from "workflow/api";
import { WorkflowRunNotFoundError } from "workflow/errors";
import { getWorld } from "workflow/runtime";
import { finishStalledGoalRebuild } from "../goals/cancel-stalled-rebuild";

/**
 * Every step attempt records its start and end, and none outlasts a function's longest run (under
 * 15 minutes), so a run quiet for twice that stopped without ending, as a crash or restart leaves it.
 */
const STALLED_AFTER_MS = 30 * 60 * 1000;

const ACTIVE_STATUSES = new Set(["pending", "running"]);

/**
 * The local world's queue lives in memory and nothing re-enqueues its runs, so a run quiet since
 * the dev server started was killed by a restart. The Vercel world's queue survives restarts.
 */
function getDevServerStart(): number | null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return Date.now() - process.uptime() * 1000;
}

type LastSign = { recordedAt: number; resumeAt: number };

type RunActivity = "alive" | "ended" | "unknown";

type RunState =
  | { activity: "alive" | "ended"; stalled: boolean; status: string }
  | { activity: "ended" | "unknown"; stalled: false; status: null };

const MISSING = { activity: "ended", stalled: false, status: null } as const;
const UNKNOWN = { activity: "unknown", stalled: false, status: null } as const;

/** Completed, failed or cancelled: the run writes nothing more. */
export function hasRunEnded(status: string): boolean {
  return !ACTIVE_STATUSES.has(status);
}

async function readLastSign(runId: string): Promise<LastSign | null> {
  const world = await getWorld();

  const { data } = await world.events.list({
    pagination: { limit: 1, sortOrder: "desc" },
    resolveData: "none",
    runId,
  });

  const [event] = data;

  if (!event) {
    return null;
  }

  const resumeAt = event.eventType === "wait_created" ? event.eventData.resumeAt.getTime() : 0;
  return { recordedAt: event.createdAt.getTime(), resumeAt };
}

async function isStalled(runId: string): Promise<boolean> {
  const sign = await readLastSign(runId);

  if (!sign) {
    return false;
  }

  const serverStart = getDevServerStart();
  const lastSign = Math.max(sign.recordedAt, sign.resumeAt);

  return (
    (serverStart !== null && sign.recordedAt < serverStart) ||
    Date.now() - lastSign > STALLED_AFTER_MS
  );
}

async function classifyRun(runId: string, status: string): Promise<RunState> {
  const stalled = ACTIVE_STATUSES.has(status) && (await isStalled(runId));
  return { activity: stalled || hasRunEnded(status) ? "ended" : "alive", stalled, status };
}

async function readState(runId: string): Promise<RunState> {
  const run = getRun(runId);
  return (await run.exists) ? classifyRun(runId, await run.status) : MISSING;
}

export async function readRunState(runId: string): Promise<RunState> {
  const { data, error } = await safeAsync(() => readState(runId));

  if (!error) {
    return data;
  }

  return WorkflowRunNotFoundError.is(error) ? MISSING : UNKNOWN;
}

/** A stalled run is cancelled before it reads as ended, so a caller can release its claim knowing it won't resume. */
export async function settleRunActivity(runId: string): Promise<RunActivity> {
  const { data, error } = await safeAsync(() => stopStalledRun(runId));
  return error ? "unknown" : data.activity;
}

function requireKnownState(state: RunState, runId: string): RunState {
  if (state.activity === "unknown") {
    throw new Error(`Could not observe workflow run ${runId}`);
  }

  return state;
}

export async function isRunActive(runId: string): Promise<boolean> {
  const state = requireKnownState(await readRunState(runId), runId);
  return state.activity === "alive";
}

export async function readClientRunStatus(runId: string): Promise<string | null> {
  const { stalled, status } = requireKnownState(await readRunState(runId), runId);
  return stalled ? "failed" : status;
}

export async function readClientRun(runId: string) {
  const { data, error } = await safeAsync(async () => {
    const world = await getWorld();
    const run = await world.runs.get(runId, { resolveData: "none" });
    const { stalled } = await classifyRun(runId, run.status);

    return { status: stalled ? "failed" : run.status, workflowName: run.workflowName };
  });

  if (error) {
    return { outcome: WorkflowRunNotFoundError.is(error) ? "missing" : "unknown" } as const;
  }

  return { outcome: "found", ...data } as const;
}

export async function stopStalledRun(runId: string): Promise<RunState> {
  const state = requireKnownState(await readRunState(runId), runId);

  if (state.stalled) {
    await finishStalledGoalRebuild(runId);

    await getRun(runId).cancel({
      cancelReason:
        "Stalled: no progress for 30 minutes, or since the development server restarted.",
    });
  }

  return state;
}
