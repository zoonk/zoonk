import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type LiveCallReservationResult } from "../../language/conversations/live-call-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type UsageDecision } from "../contract";
import { claimUsageInTransaction } from "./claim-usage-in-transaction";
import { type EntitlementViewer } from "./entitlement-viewer";
import { refreshLiveCallViewer } from "./live-call-viewer";
import { LiveCallReservationRefusedError, reserveLiveCall } from "./reserve-live-call";
import { lockUsageForViewer } from "./usage-lock";

type ViewerClaim = { generated: boolean; kind: UsageKind; seconds?: number; targetId: string };

type ClaimedAll = { decision: UsageDecision; recorded: boolean };

async function claimEach({
  claims,
  now,
  transaction,
  viewer,
}: {
  claims: readonly ViewerClaim[];
  now: Date;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<ClaimedAll> {
  const [claim, ...rest] = claims;

  if (!claim) {
    return { decision: { status: "allowed" }, recorded: false };
  }

  const first = await claimUsageInTransaction({ ...claim, now, transaction, viewer });

  if (first.decision.status !== "allowed") {
    return first;
  }

  const others = await claimEach({ claims: rest, now, transaction, viewer });
  const allowed = others.decision.status === "allowed";

  return { decision: others.decision, recorded: allowed && (first.recorded || others.recorded) };
}

/** Records every claim or none; retries of a used target are free; acquires the learner's lock before the usage lock. */
export async function claimUsageForViewer({
  claims,
  now,
  viewer,
}: {
  claims: readonly ViewerClaim[];
  now: Date;
  viewer: EntitlementViewer;
}): Promise<UsageDecision> {
  return writeLearnerChange({ userId: viewer.userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId: viewer.userId });

    const claimed = await claimEach({ claims, now, transaction, viewer });

    return claimed.recorded ? claimed.decision : unchanged(claimed.decision);
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
