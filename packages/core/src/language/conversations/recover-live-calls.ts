import "server-only";
import { captureMessage } from "@sentry/nextjs";
import { prisma } from "@zoonk/db";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { accrueLiveCallLiability } from "./_utils/settle-live-call";
import { closeLiveCallConnection } from "./close-live-call-connection";
import { type CloseLiveCallResult } from "./live-call-contract";

const DEFAULT_BATCH_SIZE = 25;

/** One durable run keeps retrying this exact connection/generation; no new recovery scheduler. */
export async function recoverLiveCallConnection({
  connectionId,
  generation,
}: {
  connectionId: string;
  generation: number;
}): Promise<CloseLiveCallResult | { deadlineAt: Date; status: "notDue" }> {
  const connection = await prisma.liveCallConnection.findUnique({ where: { id: connectionId } });

  if (!connection) {
    return { status: "notFound" };
  }

  if (connection.generation !== generation) {
    return { status: "stale" };
  }

  if (connection.state === "closed") {
    return { status: "closed" };
  }

  if (connection.state !== "closing" && connection.deadlineAt > new Date()) {
    return { deadlineAt: connection.deadlineAt, status: "notDue" };
  }

  return closeLiveCallConnection({ connectionId, generation, reason: "deadline" });
}

/** Exhausted in-run retries alert without falsely releasing a possibly billing connection. */
export async function markLiveCallRecoveryUnconfirmed({
  connectionId,
  generation,
}: {
  connectionId: string;
  generation: number;
}): Promise<void> {
  const original = await prisma.liveCallConnection.findUnique({ where: { id: connectionId } });

  if (!original) {
    return;
  }

  const marked = await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: original.userId });

    const connection = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (connection.generation !== generation || connection.state === "closed") {
      return false;
    }

    await accrueLiveCallLiability({ connection, now: new Date(), transaction });

    await transaction.liveCallConnection.update({
      data: { recoveryUnconfirmedAt: new Date() },
      where: { id: connectionId },
    });

    return connection.recoveryUnconfirmedAt === null;
  });

  if (marked) {
    captureMessage("Live call termination remains unconfirmed", {
      extra: { connectionId, generation },
      level: "error",
    });
  }
}

/** Existing daily-sweeps last-resort fallback, bounded to protect its other cleanup work. */
export async function recoverLiveCalls({ limit = DEFAULT_BATCH_SIZE }: { limit?: number } = {}) {
  const now = new Date();

  const connections = await prisma.liveCallConnection.findMany({
    orderBy: [
      { lastCloseAt: { nulls: "first", sort: "asc" } },
      { deadlineAt: "asc" },
      { id: "asc" },
    ],
    take: Math.max(1, Math.min(100, limit)),
    where: { deadlineAt: { lte: now }, state: { not: "closed" } },
  });

  const outcomes = await Promise.all(
    connections.map(async (connection) => {
      const outcome = await recoverLiveCallConnection({
        connectionId: connection.id,
        generation: connection.generation,
      });

      if (outcome.status === "closing") {
        await markLiveCallRecoveryUnconfirmed({
          connectionId: connection.id,
          generation: connection.generation,
        });
      }

      return outcome;
    }),
  );

  const oldest = await prisma.liveCallConnection.aggregate({
    _min: { deadlineAt: true },
    where: { deadlineAt: { lte: now }, state: { not: "closed" } },
  });

  const oldestOverdueSeconds = oldest._min.deadlineAt
    ? Math.max(0, Math.ceil((now.getTime() - oldest._min.deadlineAt.getTime()) / 1000))
    : 0;

  if (connections.length > 0) {
    captureMessage("Daily sweeps recovered overdue live calls", {
      extra: { attempted: connections.length, oldestOverdueSeconds },
      level: "warning",
    });
  }

  return {
    attempted: connections.length,
    closed: outcomes.filter((outcome) => outcome.status === "closed").length,
    oldestOverdueSeconds,
  };
}
