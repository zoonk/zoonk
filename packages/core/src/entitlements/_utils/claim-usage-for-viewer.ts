import { type UsageKind } from "@zoonk/db";
import { type LiveCallReservationResult } from "../../language/conversations/live-call-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type UsageDecision } from "../contract";
import { claimUsageInTransaction } from "./claim-usage-in-transaction";
import { type EntitlementViewer } from "./entitlement-viewer";
import { refreshLiveCallViewer } from "./live-call-viewer";
import { LiveCallReservationRefusedError, reserveLiveCall } from "./reserve-live-call";
import { lockUsageForViewer } from "./usage-lock";

/**
 * Counts and records one use in a transaction that holds a per-learner lock, so two tabs starting
 * lessons at once can't both take the last one. A target the learner already used returns allowed
 * without counting again: restarting a lesson or retrying a request is free. A guest's use that
 * costs AI also takes its estimated cost from the daily budget all guests share, and once that's
 * spent asks the guest to create a free account (`signUpRequired`). A live call's connection
 * (`seconds`) holds up to that much of the plan's call time (today's and this month's) and
 * returns what it holds; connecting the same call again holds its length again
 * (`holdCallTimeAgain`). A use it records marks the learner, which it does before
 * taking the usage lock (plans, then learners, then everything else, in every writer).
 */
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

    // A retried target or a refusal records nothing, so it rolls back its marks.
    return claim.recorded ? claim.decision : unchanged(claim.decision);
  });
}

/** One atomic minute, money, slot, attempt and free-day claim under the entitlement lock. */
export async function claimLiveCallUsageForViewer(input: {
  conversationId: string;
  now: Date;
  requestId: string;
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

        const existing = await transaction.liveCallConnection.findUnique({
          where: { userId_requestId: { requestId: input.requestId, userId: viewer.userId } },
        });

        const result = await reserveLiveCall({ ...input, transaction, viewer });
        return result.status !== "reserved" || existing ? unchanged(result) : result;
      },
    );
  } catch (error) {
    if (error instanceof LiveCallReservationRefusedError) {
      return error.result;
    }

    throw error;
  }
}
