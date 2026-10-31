import { safeAsync } from "@zoonk/utils/error";
import { getRun } from "workflow/api";
import { getWorld } from "workflow/runtime";

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

export type RunState = { stalled: boolean; status: string | null };

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
  const { data: sign } = await safeAsync(() => readLastSign(runId));

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

async function readState(runId: string): Promise<RunState> {
  const run = getRun(runId);

  if (!(await run.exists)) {
    return { stalled: false, status: null };
  }

  const status = await run.status;
  return { stalled: ACTIVE_STATUSES.has(status) && (await isStalled(runId)), status };
}

/** A run that can't be read counts as gone: it holds nothing anyone should wait for. */
export async function readRunState(runId: string): Promise<RunState> {
  const { data, error } = await safeAsync(() => readState(runId));
  return error ? { stalled: false, status: null } : data;
}

/**
 * Hooks only protect live runs, so a claim left by a run that crashed, was cancelled, stalled or
 * never existed (seeded content) can be taken over instead of blocking its content forever.
 */
export async function isRunActive(runId: string): Promise<boolean> {
  const { stalled, status } = await readRunState(runId);
  return status !== null && ACTIVE_STATUSES.has(status) && !stalled;
}

/** A stalled run reads as failed so the client offers to start it again. */
export async function readClientRunStatus(runId: string): Promise<string | null> {
  const { stalled, status } = await readRunState(runId);
  return stalled ? "failed" : status;
}

export async function stopStalledRun(runId: string): Promise<boolean> {
  const { stalled } = await readRunState(runId);

  if (!stalled) {
    return false;
  }

  await getRun(runId).cancel({
    cancelReason: "Stalled: no progress for 30 minutes, or since the development server restarted.",
  });

  return true;
}
