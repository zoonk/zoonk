import { type TransactionClient, type UsageRecord } from "@zoonk/db";
import { type UsageDecision } from "../contract";
import { MIN_CALL_SECONDS, getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { getCallHold, getCallTimeLeft } from "./evaluate-usage";
import { countUsage } from "./usage-counts";
import { getUsagePeriodStarts } from "./usage-periods";

const MS_PER_SECOND = 1000;

/**
 * What a call's record keeps once it ends, or once it connects again: the time since it was first
 * claimed, up to what it held. The server's clock measures it, so a client can't report a shorter
 * call; the few seconds of connecting, saving or waiting to call again count.
 */
export function getCallSecondsRun({ now, record }: { now: Date; record: UsageRecord }): number {
  const ran = Math.ceil((now.getTime() - record.createdAt.getTime()) / MS_PER_SECOND);
  return Math.min(record.seconds, Math.max(0, ran));
}

/**
 * A call connecting again after its connection dropped or never started: the time it held so far
 * keeps only what ran, and the new connection holds the call's length again from what's left of
 * the plan's call time (today's and this month's), since the learner starts it over. A call
 * claimed on an earlier day holds nothing more: its time belongs to that day.
 */
export async function holdCallTimeAgain({
  now,
  record,
  seconds,
  transaction,
  viewer,
}: {
  now: Date;
  record: UsageRecord;
  seconds: number;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageDecision> {
  if (record.createdAt < getUsagePeriodStarts(now).day) {
    return { heldSeconds: 0, status: "allowed" };
  }

  const ran = getCallSecondsRun({ now, record });

  const counts = await countUsage({
    client: transaction,
    kind: record.kind,
    now,
    userId: viewer.userId,
  });

  // This call's record is in both counts with what it held; it keeps only what ran.
  const released = record.seconds - ran;

  const left = getCallTimeLeft({
    kind: record.kind,
    tier: viewer.tier,
    usedThisMonth: counts.secondsThisMonth - released,
    usedToday: counts.secondsToday - released,
  });

  if (left && left.seconds < MIN_CALL_SECONDS) {
    return {
      limit: { limit: left.limit, period: left.period, resource: "callSeconds", tier: viewer.tier },
      status: "limitReached",
    };
  }

  const hold = getCallHold({ left, seconds });
  const total = ran + hold.heldSeconds;

  await transaction.usageRecord.update({
    data: {
      costMicros: getEstimatedCostMicros({
        generated: record.generated,
        kind: record.kind,
        seconds: total,
      }),
      seconds: total,
    },
    where: { id: record.id },
  });

  return hold.shortenedBy
    ? { heldSeconds: hold.heldSeconds, shortenedBy: hold.shortenedBy, status: "allowed" }
    : { heldSeconds: hold.heldSeconds, status: "allowed" };
}
