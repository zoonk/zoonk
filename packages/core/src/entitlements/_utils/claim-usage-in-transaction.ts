import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type UsageDecision } from "../contract";
import { getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { claimGuestSpend } from "./guest-spend-budget";
import { countUsage } from "./usage-counts";

type UsageClaim = { decision: UsageDecision; recorded: boolean };

async function findRefusedLessonReplay({
  decision,
  lessonId,
  transaction,
  userId,
}: {
  decision: UsageDecision;
  lessonId: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<Date | null> {
  if (decision.status !== "limitReached" || decision.limit.resource !== "lessonStart") {
    return null;
  }

  const [event] = await transaction.$queryRaw<{ startedAt: Date }[]>`
    SELECT started_at AS "startedAt" FROM learning_events
    WHERE user_id = ${userId}::uuid AND kind = 'lesson'
      AND content_ids @> jsonb_build_object('lessonId', ${lessonId}::text)
    ORDER BY started_at ASC LIMIT 1
  `;

  return event?.startedAt ?? null;
}

export async function claimUsageInTransaction({
  continuing = false,
  generated,
  preparing = false,
  kind,
  now,
  seconds,
  targetId,
  transaction,
  viewer,
}: {
  /** Continues a start the limits already admitted, so only its use is recorded. */
  continuing?: boolean;
  generated: boolean;
  preparing?: boolean;
  kind: UsageKind;
  now: Date;
  seconds?: number;
  targetId: string;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageClaim> {
  const existing = await transaction.usageRecord.findUnique({
    where: { userUsageTarget: { kind, targetId, userId: viewer.userId } },
  });

  if (existing) {
    if (kind !== "lessonStart" || preparing || existing.countedAt !== null) {
      return { decision: { status: "allowed" }, recorded: false };
    }

    const decision =
      viewer.tier === "free"
        ? evaluateUsage({
            costMicros: 0,
            counts: await countUsage({
              client: transaction,
              kind,
              now,
              tier: viewer.tier,
              userId: viewer.userId,
            }),
            generated: false,
            kind,
            now,
            tier: viewer.tier,
          })
        : { status: "allowed" as const };

    const replayedAt = await findRefusedLessonReplay({
      decision,
      lessonId: targetId,
      transaction,
      userId: viewer.userId,
    });

    if (decision.status !== "allowed" && !replayedAt) {
      return { decision, recorded: false };
    }

    await transaction.usageRecord.update({
      data: { countedAt: replayedAt ?? now },
      where: { id: existing.id },
    });

    return { decision: { status: "allowed" }, recorded: true };
  }

  const costMicros = getEstimatedCostMicros({ generated, kind, seconds });

  const decision: UsageDecision = continuing
    ? { status: "allowed" }
    : evaluateUsage({
        costMicros,
        counts: await countUsage({
          client: transaction,
          kind,
          now,
          tier: viewer.tier,
          userId: viewer.userId,
        }),
        generated,
        kind,
        now,
        preparing,
        tier: viewer.tier,
      });

  if (decision.status !== "allowed") {
    return { decision, recorded: false };
  }

  const takesGuestBudget = viewer.isGuest && costMicros > 0;

  if (takesGuestBudget && !(await claimGuestSpend({ costMicros, now, transaction }))) {
    return { decision: { status: "signUpRequired" }, recorded: false };
  }

  await transaction.usageRecord.create({
    data: {
      costMicros,
      countedAt: kind === "lessonStart" && !preparing ? now : null,
      createdAt: now,
      generated,
      kind,
      seconds: seconds ?? 0,
      targetId,
      userId: viewer.userId,
    },
  });

  return { decision, recorded: true };
}
