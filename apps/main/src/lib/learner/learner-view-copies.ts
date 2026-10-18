/** The per-learner views the browser holds and reads again only when they're old. */
export type LearnerViewKind = "today";

/**
 * One read of a learner view: the viewer it was read for, the learner revision read before its
 * data (so a copy never claims a newer revision than its data shows), when the server read it, and
 * the study day it shows (`goalId:YYYY-MM-DD`), which the summary's day is checked against once
 * midnight or a carried day's end passes.
 */
export type LearnerViewCopy<View> = {
  day: string | null;
  readAt: number;
  revision: string;
  userId: string;
  view: View;
};

/**
 * What `GET /api/learner/views/{kind}` answers: the view, or the other state the page shows (a
 * paused goal, no goal, no session), which only the page's own render draws, with the learner's
 * revision it was read at (null when there's none to read, like a learner not found).
 */
export type LearnerViewResponse<View> =
  | { copy: LearnerViewCopy<View>; status: "ready" }
  | { revision: string | null; state: string; status: "elsewhere" };

/** What a shown view or page state is: the learner, the revision and the day it was read at. */
export type LearnerViewStamp = Pick<LearnerViewCopy<unknown>, "day" | "revision" | "userId">;

/**
 * What the tab learned that can make a shown view old, each with the moment it learned it (`seq`,
 * a counter every signal raises): the highest revision the learner's writes committed (the
 * watermark), the last write whose revision it doesn't know, the last time a screen said content
 * arrived without a write (a lesson written meanwhile), the last deadline that passed, and the last
 * time the summary named another study day. A view read covers every signal up to the `seq` it was
 * sent at, since the server reads the revision before the view.
 */
export type ViewFreshness = {
  contentSeq: number;
  daySeq: number;
  deadlineSeq: number;
  seq: number;
  unknownWriteSeq: number;
  watermark: { revision: bigint; seq: number; userId: string } | null;
};

/**
 * Whether a shown view must be read again: since the last read that answered (`coveredSeq`), the
 * learner's revision moved past it, a write left a revision the tab doesn't know, content arrived,
 * a deadline passed, or the summary named another day than the one shown. A read that came back no
 * newer (a write that changed nothing) is never read again for the same signal.
 */
export function isViewOld({
  coveredSeq,
  freshness,
  shown,
  summaryDay,
}: {
  coveredSeq: number;
  freshness: ViewFreshness;
  shown: LearnerViewStamp;
  summaryDay: string | null;
}): boolean {
  const { watermark } = freshness;

  const revisionMoved =
    watermark !== null &&
    watermark.userId === shown.userId &&
    watermark.seq > coveredSeq &&
    watermark.revision > BigInt(shown.revision);

  const dayMoved = summaryDay !== null && summaryDay !== shown.day && freshness.daySeq > coveredSeq;

  return (
    revisionMoved ||
    dayMoved ||
    freshness.unknownWriteSeq > coveredSeq ||
    freshness.contentSeq > coveredSeq ||
    freshness.deadlineSeq > coveredSeq
  );
}

/**
 * The newer of two copies (or stamps) of one learner's view: the higher revision, else the later
 * read. A stamp that doesn't say when it was read counts as read before any copy.
 */
export function pickNewerView<
  Copy extends Pick<LearnerViewStamp, "revision" | "userId"> & { readAt?: number },
>(shown: Copy, held: Copy | null): Copy {
  if (!held || held.userId !== shown.userId) {
    return shown;
  }

  const [heldRevision, shownRevision] = [BigInt(held.revision), BigInt(shown.revision)];

  if (heldRevision !== shownRevision) {
    return heldRevision > shownRevision ? held : shown;
  }

  return (held.readAt ?? 0) > (shown.readAt ?? 0) ? held : shown;
}

/**
 * What a read came to: its copy reached the screen (`shown`), the view said the page shows another
 * state now (`elsewhere`, which the page draws by rendering again), or nothing landed (`failed`: no
 * answer, or one for an identity the tab no longer holds).
 */
export type LearnerViewRead = "elsewhere" | "failed" | "shown";
