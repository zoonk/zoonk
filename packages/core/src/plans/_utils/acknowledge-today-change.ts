import "server-only";
import { prisma } from "@zoonk/db";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { type AcknowledgeTodayPlanChangeResult } from "../today-change-contract";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";

function acknowledgmentResult(changeId: string): AcknowledgeTodayPlanChangeResult {
  return { changeId, status: "acknowledged" };
}

class NoticeUnchangedError extends Error {
  override name = "NoticeUnchangedError";
  readonly status: "acknowledged" | "retryable";

  constructor(status: "acknowledged" | "retryable") {
    super(status);
    this.status = status;
  }
}

/** Stored notices retain their acknowledgment behavior; duplicate taps roll the early mark back. */
export async function acknowledgeStoredNotice({
  changeId,
  userId,
}: {
  changeId: string;
  userId: string;
}): Promise<AcknowledgeTodayPlanChangeResult> {
  const owned = await prisma.planChange.findFirst({
    where: { id: changeId, plan: { goal: { userId } } },
  });

  if (!owned) {
    return { status: "notFound" };
  }

  if (owned.status !== "applied") {
    return { status: "retryable" };
  }

  if (parsePlanChangePayload(owned.payload).seenAt !== null) {
    return acknowledgmentResult(changeId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId });
      const current = await tx.planChange.findUniqueOrThrow({ where: { id: changeId } });

      if (current.status !== "applied") {
        throw new NoticeUnchangedError("retryable");
      }

      const payload = parsePlanChangePayload(current.payload);

      if (payload.seenAt !== null) {
        throw new NoticeUnchangedError("acknowledged");
      }

      await tx.planChange.update({
        data: { payload: toPlanChangePayload({ ...payload, seenAt: new Date().toISOString() }) },
        where: { id: changeId },
      });
    });
  } catch (error) {
    if (!(error instanceof NoticeUnchangedError)) {
      throw error;
    }

    if (error.status === "retryable") {
      return { status: "retryable" };
    }
  }

  return acknowledgmentResult(changeId);
}
