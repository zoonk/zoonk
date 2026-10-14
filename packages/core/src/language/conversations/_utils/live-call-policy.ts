import { LIVE_CALL_CREATE_TIMEOUT_MS } from "@zoonk/ai/tasks/v2/language/live-call-creation";
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

/** Twice the adapter's abort, so a creation request can no longer return a provider ID. */
const CREATION_SETTLED_MS = 2 * LIVE_CALL_CREATE_TIMEOUT_MS;

function cleanupBlockingDeadline(now: Date): Date {
  return new Date(now.getTime() - LIVE_CALL_HEALTH_THRESHOLD_MS);
}

/**
 * A connection without a provider ID can never be confirmed closed. Past its deadline, once no
 * creation request can still return an ID, it closes and keeps its estimated cost.
 */
export function canSettleWithoutProvider({
  connection,
  now,
}: {
  connection: LiveCallConnection;
  now: Date;
}): boolean {
  if (connection.providerSessionId !== null) {
    return false;
  }

  const startedAt = connection.providerStartedAt ?? connection.createdAt;

  return now >= connection.deadlineAt && now.getTime() >= startedAt.getTime() + CREATION_SETTLED_MS;
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
      connection.deadlineAt < cleanupBlockingDeadline(now),
    overdue: connection.state !== "closed" && connection.deadlineAt < now,
  };
}

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
      deadlineAt: { lt: cleanupBlockingDeadline(now) },
      state: { in: [...POSSIBLY_BILLING_STATES] },
    },
  });

  return stuckLearners.length < SYSTEMIC_CLEANUP_FAILURE_LEARNERS;
}

/** Liability keeps accruing after failed shutdown; the intended deadline is never a cost cap. */
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

  return Math.max(
    connection.liabilityMicros,
    getLiveCallCostMicros(
      Math.ceil((now.getTime() - connection.providerStartedAt.getTime()) / 1000),
    ),
  );
}
