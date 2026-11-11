import {
  type BundleClaim,
  type UsageLedger,
  decideBundle,
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
    plusRequired: chapters
      .filter((chapter) => chapter.status === "plusRequired")
      .map((chapter) => chapter.chapterId),
  };
}

/** A map and each lesson it writes first are claimed together, or not at all. */
export function chapterMapClaims({
  chapterId,
  lessonIds,
}: {
  chapterId: string;
  lessonIds: readonly string[];
}): BundleClaim[] {
  return [
    { generated: true, kind: "mindMap", targetId: chapterId },
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

type OfferWalk = { ledger: UsageLedger; startable: number; stop: MindMapAllowanceStop | null };

function walkOffer({ chapterId, walk }: { chapterId: string; walk: OfferWalk }): OfferWalk {
  const decided = decideBundle({
    claims: chapterMapClaims({ chapterId, lessonIds: [] }),
    ledger: walk.ledger,
  });

  if (decided.decision.status === "allowed") {
    return { ledger: decided.ledger, startable: walk.startable + 1, stop: walk.stop };
  }

  if (decided.decision.status === "unauthorized" || walk.stop) {
    return walk;
  }

  return {
    ledger: walk.ledger,
    startable: walk.startable,
    stop: toAllowanceStop({ decision: decided.decision, now: walk.ledger.now }),
  };
}

/**
 * The offer walks the eligible chapters as the write admits them, against the same ledger rules.
 * With none eligible, `stop` is what would stop one more map now, asked of the next chapter's map.
 */
export function offerChapterMaps({
  chapters,
  ledger,
}: {
  chapters: readonly BulkChapter[];
  ledger: UsageLedger | null;
}): MindMapCreateOffer {
  const { eligible, needLessons } = sortBulkChapters(chapters);

  if (!ledger) {
    return { eligible: eligible.length, needLessons: needLessons.length, startable: 0, stop: null };
  }

  const walked = eligible.reduce<OfferWalk>((walk, chapterId) => walkOffer({ chapterId, walk }), {
    ledger,
    startable: 0,
    stop: null,
  });

  const [next] = eligible.length > 0 ? [] : needLessons;

  return {
    eligible: eligible.length,
    needLessons: needLessons.length,
    startable: walked.startable,
    stop: next ? walkOffer({ chapterId: next, walk: walked }).stop : walked.stop,
  };
}
