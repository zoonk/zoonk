import { fitsGuestSpend } from "../../entitlements/_utils/guest-spend-budget";
import {
  type BundleClaim,
  type UsageLedger,
  decideBundle,
  decideNewClaim,
} from "../../entitlements/_utils/usage-ledger";
import { getUsageResets } from "../../entitlements/_utils/usage-periods";
import { type UsageDecision } from "../../entitlements/contract";
import { getEstimatedCostMicros } from "../../entitlements/limits";
import {
  type MindMapAllowanceStop,
  type MindMapCreateOffer,
  type MindMapStatus,
} from "../mind-map-contract";

const MS_PER_SECOND = 1000;

type BulkChapter = { chapterId: string; lessonsToWrite: number; status: MindMapStatus };

/**
 * What "Create all chapter maps" does with each chapter, in the order given: it makes `eligible`
 * maps (none ready or on its way, every lesson written) and joins `onItsWay` ones. It
 * never writes lessons, since each costs far more than a map: `needLessons` chapters wait for their
 * own request, which writes them first.
 */
export function sortBulkChapters(chapters: readonly BulkChapter[]) {
  const without = chapters.filter(
    (chapter) => chapter.status === "available" || chapter.status === "failed",
  );

  return {
    eligible: without
      .filter((chapter) => chapter.lessonsToWrite === 0)
      .map((chapter) => chapter.chapterId),
    needLessons: without
      .filter((chapter) => chapter.lessonsToWrite > 0)
      .map((chapter) => chapter.chapterId),
    onItsWay: chapters
      .filter((chapter) => chapter.status === "drawing")
      .map((chapter) => chapter.chapterId),
  };
}

const MAP_CLAIM = { generated: true, kind: "mindMap" } as const;

/** A map and each lesson it writes first are claimed together, or not at all. */
export function chapterMapClaims({
  chapterId,
  lessonIds,
}: {
  chapterId: string;
  lessonIds: readonly string[];
}): BundleClaim[] {
  return [
    { ...MAP_CLAIM, targetId: chapterId },
    ...lessonIds.map((lessonId) => ({
      generated: true,
      kind: "lessonStart" as const,
      targetId: lessonId,
    })),
  ];
}

export function toAllowanceStop({
  decision,
  now,
}: {
  decision: Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>;
  now: Date;
}): MindMapAllowanceStop {
  if (decision.status === "signUpRequired") {
    return { availableAt: null, period: null, reason: "signUpRequired", resource: null };
  }

  if (decision.status === "slowDown") {
    const availableAt = new Date(now.getTime() + decision.retryAfterSeconds * MS_PER_SECOND);

    return {
      availableAt: availableAt.toISOString(),
      period: null,
      reason: "slowDown",
      resource: null,
    };
  }

  const { period, resource } = decision.limit;
  const resets = getUsageResets(now);

  const availableAt =
    period === "day"
      ? resets.day.toISOString()
      : (decision.limit.availableAt?.toISOString() ?? null);

  return {
    availableAt,
    period,
    reason: "limitReached",
    resource: resource === "aiSpend" ? "aiSpend" : "mindMap",
  };
}

/**
 * What all guests spent today, for a guest; null for an account, which never takes from it. The
 * write takes a guest's cost from that day too.
 */
type GuestSpent = number | null;

/** As the write admits them, against the same ledger rules: a map already claimed starts free. */
function countStartable({
  eligible,
  guestSpent,
  ledger,
}: {
  eligible: readonly string[];
  guestSpent: GuestSpent;
  ledger: UsageLedger;
}): number {
  const walked = eligible.reduce(
    (walk, chapterId) => {
      const decided = decideBundle({
        claims: chapterMapClaims({ chapterId, lessonIds: [] }),
        ledger: walk.ledger,
      });

      const costMicros = decided.recorded.reduce((sum, claim) => sum + claim.costMicros, 0);

      const fits =
        walk.guestSpent === null || fitsGuestSpend({ costMicros, spentMicros: walk.guestSpent });

      return decided.decision.status === "allowed" && fits
        ? {
            guestSpent: walk.guestSpent === null ? null : walk.guestSpent + costMicros,
            ledger: decided.ledger,
            startable: walk.startable + 1,
          }
        : walk;
    },
    { guestSpent, ledger, startable: 0 },
  );

  return walked.startable;
}

/** What stops a map the learner hasn't claimed yet; a failed map's retry doesn't count as one. */
function stopNewMap({
  guestSpent,
  ledger,
}: {
  guestSpent: GuestSpent;
  ledger: UsageLedger;
}): MindMapAllowanceStop | null {
  const decision = decideNewClaim({ claim: MAP_CLAIM, ledger });

  if (decision.status === "unauthorized") {
    return null;
  }

  if (decision.status !== "allowed") {
    return toAllowanceStop({ decision, now: ledger.now });
  }

  const costMicros = getEstimatedCostMicros(MAP_CLAIM);

  return guestSpent === null || fitsGuestSpend({ costMicros, spentMicros: guestSpent })
    ? null
    : toAllowanceStop({ decision: { status: "signUpRequired" }, now: ledger.now });
}

/** What "Create all chapter maps" would start now, and what stops a new map now. */
export function offerChapterMaps({
  chapters,
  guestSpent,
  ledger,
}: {
  chapters: readonly BulkChapter[];
  guestSpent: GuestSpent;
  ledger: UsageLedger | null;
}): MindMapCreateOffer {
  const { eligible, needLessons } = sortBulkChapters(chapters);
  const counts = { eligible: eligible.length, needLessons: needLessons.length };

  if (!ledger) {
    return { ...counts, startable: 0, stop: null };
  }

  return {
    ...counts,
    startable: countStartable({ eligible, guestSpent, ledger }),
    stop: stopNewMap({ guestSpent, ledger }),
  };
}
