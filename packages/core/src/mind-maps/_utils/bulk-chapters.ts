import {
  type BundleClaim,
  type UsageLedger,
  decideBundle,
  decideNewClaim,
} from "../../entitlements/_utils/usage-ledger";
import { getUsageResets } from "../../entitlements/_utils/usage-periods";
import { type UsageDecision } from "../../entitlements/contract";
import {
  type MindMapAllowanceStop,
  type MindMapCreateOffer,
  type MindMapStatus,
} from "../mind-map-contract";

const MS_PER_SECOND = 1000;

type BulkChapter = { chapterId: string; lessonsToWrite: number; status: MindMapStatus };

/**
 * What "Create all chapter maps" does with each chapter, in the order given: it makes `eligible`
 * maps (none ready or on its way, every lesson written, not locked) and joins `onItsWay` ones. It
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
    return { period: null, reason: "signUpRequired", resetsAt: null, resource: null };
  }

  if (decision.status === "slowDown") {
    const resetsAt = new Date(now.getTime() + decision.retryAfterSeconds * MS_PER_SECOND);
    return { period: null, reason: "slowDown", resetsAt: resetsAt.toISOString(), resource: null };
  }

  if (decision.limit.period === "rolling30Days") {
    return {
      period: "rolling30Days",
      reason: "limitReached",
      resetsAt: decision.limit.availableAt.toISOString(),
      resource: "lessonStart",
    };
  }

  const { period, resource } = decision.limit;
  const resets = getUsageResets(now);
  const resetsAt = period === "total" ? null : resets[period].toISOString();

  return {
    period,
    reason: "limitReached",
    resetsAt,
    resource: resource === "aiSpend" ? "aiSpend" : "mindMap",
  };
}

/** As the write admits them, against the same ledger rules: a map already claimed starts free. */
function countStartable({
  eligible,
  ledger,
}: {
  eligible: readonly string[];
  ledger: UsageLedger;
}): number {
  const walked = eligible.reduce(
    (walk, chapterId) => {
      const decided = decideBundle({
        claims: chapterMapClaims({ chapterId, lessonIds: [] }),
        ledger: walk.ledger,
      });

      return decided.decision.status === "allowed"
        ? { ledger: decided.ledger, startable: walk.startable + 1 }
        : walk;
    },
    { ledger, startable: 0 },
  );

  return walked.startable;
}

/** What stops a map the learner hasn't claimed yet; a failed map's retry doesn't count as one. */
function stopNewMap(ledger: UsageLedger): MindMapAllowanceStop | null {
  const decision = decideNewClaim({ claim: MAP_CLAIM, ledger });

  return decision.status === "allowed" || decision.status === "unauthorized"
    ? null
    : toAllowanceStop({ decision, now: ledger.now });
}

/** What "Create all chapter maps" would start now, and what stops a new map now. */
export function offerChapterMaps({
  chapters,
  ledger,
}: {
  chapters: readonly BulkChapter[];
  ledger: UsageLedger | null;
}): MindMapCreateOffer {
  const { eligible, needLessons } = sortBulkChapters(chapters);
  const counts = { eligible: eligible.length, needLessons: needLessons.length };

  if (!ledger) {
    return { ...counts, startable: 0, stop: null };
  }

  return { ...counts, startable: countStartable({ eligible, ledger }), stop: stopNewMap(ledger) };
}
