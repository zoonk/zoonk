import { type UsageKind } from "@zoonk/db";
import { type LiveCallReservationResult } from "../../language/conversations/live-call-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type UsageDecision } from "../contract";
import { claimUsageInTransaction } from "./claim-usage-in-transaction";
import { type EntitlementViewer } from "./entitlement-viewer";
import { refreshLiveCallViewer } from "./live-call-viewer";
import { LiveCallReservationRefusedError, reserveLiveCall } from "./reserve-live-call";
import { lockUsageForViewer } from "./usage-lock";

/** Retries of a used target are free; claims acquire the learner's lock before the usage lock. */
export async function claimUsageForViewer({
  generated,
  kind,
  now,
  seconds,
  targetId,
  viewer,
}: {
  generated: boolean;
  kind: UsageKind;
  now: Date;
  seconds?: number;
  targetId: string;
  viewer: EntitlementViewer;
}): Promise<UsageDecision> {
  return writeLearnerChange({ userId: viewer.userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId: viewer.userId });

    const claim = await claimUsageInTransaction({
      generated,
      kind,
      now,
      seconds,
      targetId,
      transaction,
      viewer,
    });

    return claim.recorded ? claim.decision : unchanged(claim.decision);
  });
}

export async function claimLiveCallUsageForViewer(input: {
  conversationId: string;
  now: Date;
  viewer: EntitlementViewer;
}): Promise<LiveCallReservationResult> {
  try {
    return await writeLearnerChange<LiveCallReservationResult>(
      { userId: input.viewer.userId },
      async (transaction) => {
        await lockUsageForViewer({ transaction, userId: input.viewer.userId });

        const viewer = await refreshLiveCallViewer({
          isGuest: input.viewer.isGuest,
          now: input.now,
          transaction,
          userId: input.viewer.userId,
        });

        if (!viewer) {
          return unchanged({ status: "unauthorized" as const });
        }

        const result = await reserveLiveCall({ ...input, transaction, viewer });
        return result.status === "reserved" ? result : unchanged(result);
      },
    );
  } catch (error) {
    if (error instanceof LiveCallReservationRefusedError) {
      return error.result;
    }

    throw error;
  }
}
