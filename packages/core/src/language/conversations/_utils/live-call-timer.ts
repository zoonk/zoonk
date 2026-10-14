import { type LiveCallConnection, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { type LiveCallDeadlineScheduler } from "../live-call-contract";
import { settleLiveCall } from "./settle-live-call";

async function refundUnscheduledConnection(connection: LiveCallConnection): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockUsageForViewer({ transaction, userId: connection.userId });

    const current = await transaction.liveCallConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    if (current.state !== "pending" || current.workflowRunId !== null) {
      return;
    }

    await transaction.liveCallConnection.update({
      data: { endReason: "timerFailed" },
      where: { id: current.id },
    });

    await settleLiveCall({ connection: current, now: new Date(), seconds: null, transaction });
  });
}

/** A duplicate start is harmless: redemption requires one persisted receipt and the same fence. */
export async function attachLiveCallDeadline({
  connection,
  scheduleDeadline,
}: {
  connection: LiveCallConnection;
  scheduleDeadline: LiveCallDeadlineScheduler;
}): Promise<LiveCallConnection | null> {
  const receipt = connection.workflowRunId
    ? { data: { runId: connection.workflowRunId } }
    : await safeAsync(() =>
        scheduleDeadline({
          connectionId: connection.id,
          deadlineAt: connection.deadlineAt,
          generation: connection.generation,
        }),
      );

  if (!receipt.data?.runId) {
    await refundUnscheduledConnection(connection);
    return null;
  }

  await prisma.liveCallConnection.updateMany({
    data: { workflowRunId: receipt.data.runId },
    where: {
      generation: connection.generation,
      id: connection.id,
      state: "pending",
      workflowRunId: null,
    },
  });

  const current = await prisma.liveCallConnection.findUniqueOrThrow({
    where: { id: connection.id },
  });

  return current.state === "pending" && current.workflowRunId && current.deadlineAt > new Date()
    ? current
    : null;
}
