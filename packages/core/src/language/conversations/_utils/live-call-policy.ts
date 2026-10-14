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

function cleanupBlockingDeadline(now: Date): Date {
  return new Date(now.getTime() - LIVE_CALL_HEALTH_THRESHOLD_MS);
}

/** The displayed flags and the global admission guard share one deadline and state policy. */
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
  const overdue = await transaction.liveCallConnection.findFirst({
    where: {
      deadlineAt: { lt: cleanupBlockingDeadline(now) },
      state: { in: [...POSSIBLY_BILLING_STATES] },
    },
  });

  return overdue === null;
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
