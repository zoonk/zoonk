import { safeAsync } from "@zoonk/utils/error";
import { getRun } from "workflow/api";
import { getWorld } from "workflow/runtime";

/**
 * How long a run of ours goes at most without recording anything, with a wide margin: every step
 * attempt records its start and end, and none outlasts a function's longest run (under 15 minutes,
 * a model call's own retries included), and a run asleep counts from when it wakes. A run quiet
 * for longer stopped without ending, as a crash or a server restart leaves it: it still says it's
 * running, but it never will again.
 */
const STALLED_AFTER_MS = 30 * 60 * 1000;

const ACTIVE_STATUSES = new Set(["pending", "running"]);

const LOCAL_WORLDS = new Set(["local", "@workflow/world-local"]);

/**
 * When this server started, on a development server running the local world: its queue lives in
 * memory and nothing starts the world to re-enqueue runs, so a run that recorded nothing since the
 * server started was killed by a restart and never moves again. Null elsewhere: the Vercel world's
 * queue survives restarts, so a run quiet that long is only waiting.
 */
function getDevServerStart(): number | null {
  const world =
    process.env.WORKFLOW_TARGET_WORLD || (process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "local");

  if (process.env.NODE_ENV !== "development" || !LOCAL_WORLDS.has(world)) {
    return null;
  }

  return Date.now() - process.uptime() * 1000;
}

type LastSign = { recordedAt: number; resumeAt: number };

/** A run as another run or a request sees it: its status (null once it's gone), and whether it stalled. */
export type RunState = { stalled: boolean; status: string | null };

/** When a run last recorded something, and the end of the sleep it's in, if any. */
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

/**
 * Whether an active run stalled: quiet past the stall time (a sleep counts from when it wakes), or
 * left behind by a restart of a development server (`getDevServerStart`). When its events can't be
 * read, it's given the benefit of the doubt.
 */
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

/**
 * A run's status and whether it stalled. A run that can't be read counts as gone: it holds
 * nothing anyone should wait for.
 */
export async function readRunState(runId: string): Promise<RunState> {
  const { data, error } = await safeAsync(() => readState(runId));
  return error ? { stalled: false, status: null } : data;
}

/**
 * Whether a run that holds a database claim or a token is still working. Hooks only protect runs
 * that are alive, so a claim left by a run that crashed, was cancelled or stalled would block its
 * content forever; a claim whose run is gone (or whose id was never a run, like seeded content)
 * can be taken over.
 */
export async function isRunActive(runId: string): Promise<boolean> {
  const { stalled, status } = await readRunState(runId);
  return status !== null && ACTIVE_STATUSES.has(status) && !stalled;
}

/**
 * The status a client is told: a stalled run has failed for them, so their screen offers to start
 * it again, and the start takes its place (see `stopStalledRun`).
 */
export async function readClientRunStatus(runId: string): Promise<string | null> {
  const { stalled, status } = await readRunState(runId);
  return stalled ? "failed" : status;
}

/**
 * Cancels a run that stalled, which frees its hooks' tokens, so whatever it held starts again
 * instead of being joined forever. Returns whether it stopped one.
 */
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
