import {
  LIVE_CALL_CREATE_TIMEOUT_MS,
  LIVE_SESSION_ESTIMATED_MAX_SECONDS,
} from "@zoonk/ai/tasks/v2/language/live-call-creation";
import { isLiveCallAvailable } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { type LiveCallConnection, type TransactionClient } from "@zoonk/db";
import { LIVE_CALL_HEALTH_THRESHOLD_MS, getLiveCallCostMicros } from "../../../entitlements/limits";

export const LIVE_CALL_SETTING_ID = "live";

/** Mutation preconditions deliberately bypass cached settings and provider availability. */
export async function readLiveCallAdmission({
  transaction,
  userId,
}: {
  transaction: TransactionClient;
  userId: string;
}): Promise<number | null> {
  const [setting, user] = await Promise.all([
    transaction.liveCallSetting.findUnique({ where: { id: LIVE_CALL_SETTING_ID } }),
    transaction.user.findUnique({ where: { id: userId } }),
  ]);

  if (
    !setting ||
    !user ||
    !isLiveCallAvailable() ||
    !Number.isSafeInteger(setting.freeDailyBudgetMicros) ||
    setting.freeDailyBudgetMicros < 0
  ) {
    return null;
  }

  if (setting.admission === "all" || (setting.admission === "staff" && user.role === "admin")) {
    return setting.freeDailyBudgetMicros;
  }

  return null;
}

const POSSIBLY_BILLING_STATES = ["creating", "active", "closing"] as const;

/**
 * One learner's stuck connection is that learner's problem: their slot already holds their next
 * call. Stuck connections of this many learners at once mean cleanup itself is failing.
 */
const SYSTEMIC_CLEANUP_FAILURE_LEARNERS = 3;

/** Twice the adapter's abort: no creation request is still waiting on the provider. */
const CREATION_SETTLED_MS = 2 * LIVE_CALL_CREATE_TIMEOUT_MS;

/** When a session is taken to be over: its estimated longest run after creation. */
const SESSION_SETTLED_MS = LIVE_SESSION_ESTIMATED_MAX_SECONDS * 1000 + CREATION_SETTLED_MS;

/** The most a provider session is taken to bill: its estimated longest run. */
const LONGEST_SESSION_MICROS = getLiveCallCostMicros(LIVE_SESSION_ESTIMATED_MAX_SECONDS);

function cleanupBlockingDeadline(now: Date): Date {
  return new Date(now.getTime() - LIVE_CALL_HEALTH_THRESHOLD_MS);
}

function settledAfterMs(connection: LiveCallConnection): number {
  return connection.providerSessionId === null ? CREATION_SETTLED_MS : SESSION_SETTLED_MS;
}

/**
 * When no close can confirm a session anymore, it settles by estimate.
 * - Without a provider ID: past its deadline, once its creation request is over. The browser never
 *   got the answer, so the session can't start running, and OpenAI bills one that hasn't started
 *   for its 15-second initialization, far below the reservation kept. An ID that still turns up
 *   opens the row again (`persistLiveCallSession`).
 * - With one: once its estimated longest run is over, keeping that run's cost. A receipt that still
 *   comes replaces the estimate (`closeLiveCallConnection`).
 */
export function canSettleByEstimate({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): boolean {
  const startedAt = (connection.providerStartedAt ?? connection.createdAt).getTime();

  return (
    (connection.providerSessionId !== null || now >= connection.deadlineAt) &&
    now.getTime() >= startedAt + settledAfterMs(connection)
  );
}

/** The displayed flags and the systemic admission guard share one deadline and state policy. */
export function getLiveCallAdminHealth({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): { cleanupBlocking: boolean; overdue: boolean } {
  return {
    cleanupBlocking:
      POSSIBLY_BILLING_STATES.some((state) => state === connection.state) &&
      connection.deadlineAt < cleanupBlockingDeadline(now) &&
      !canSettleByEstimate({ connection, now }),
    overdue: connection.state !== "closed" && connection.deadlineAt < now,
  };
}

function startedAfter(cutoff: Date) {
  return [
    { providerStartedAt: { gt: cutoff } },
    { createdAt: { gt: cutoff }, providerStartedAt: null },
  ];
}

/** The SQL form of `getLiveCallAdminHealth`: settling by estimate already bounds a row's cost. */
export async function isLiveCallCleanupHealthy({
  transaction,
  now,
}: {
  transaction: TransactionClient;
  now: Date;
}): Promise<boolean> {
  const stuckLearners = await transaction.liveCallConnection.groupBy({
    by: ["userId"],
    where: {
      OR: [
        {
          OR: startedAfter(new Date(now.getTime() - CREATION_SETTLED_MS)),
          providerSessionId: null,
        },
        {
          OR: startedAfter(new Date(now.getTime() - SESSION_SETTLED_MS)),
          providerSessionId: { not: null },
        },
      ],
      deadlineAt: { lt: cleanupBlockingDeadline(now) },
      state: { in: [...POSSIBLY_BILLING_STATES] },
    },
  });

  return stuckLearners.length < SYSTEMIC_CLEANUP_FAILURE_LEARNERS;
}

/**
 * Liability keeps accruing after failed shutdown, up to the estimated longest run; the intended
 * deadline is never a cost cap.
 */
export function getLiveCallLiability({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): number {
  if (connection.state === "closed") {
    return connection.settledMicros;
  }

  if (!connection.providerStartedAt) {
    return connection.liabilityMicros;
  }

  const elapsedSeconds = Math.ceil((now.getTime() - connection.providerStartedAt.getTime()) / 1000);

  return Math.max(
    connection.liabilityMicros,
    Math.min(getLiveCallCostMicros(elapsedSeconds), LONGEST_SESSION_MICROS),
  );
}
