import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";

/**
 * A read of the server's (`server`) or the browser's own guess that nobody is signed in (no
 * session hint): the learner's summary or nobody, when it was read, and the session hint's tag of
 * the learner it was read for (null for nobody).
 */
export type Snapshot = {
  readAt: number;
  source: "guess" | "server";
  summary: LearnerSummary | null;
  tag: string | null;
};

/**
 * The learner summary as the browser holds it: not read yet, a visitor (no session), the learner's
 * summary, or a read that failed (the frame then shows its neutral look, never made-up data).
 */
export type LearnerSummaryState =
  | { status: "failed" }
  | { status: "not-loaded" }
  | { status: "ready"; summary: LearnerSummary }
  | { status: "visitor" };

/** What a page's server render hands the store (`LearnerSummarySeed`). */
export type LearnerSummarySeedValue =
  | { status: "failed" }
  | { status: "ready"; summary: LearnerSummary; tag: string }
  | { status: "visitor" };

/** A timer longer than a day isn't needed: the summary changes at the learner's midnight. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/**
 * How long a summary is held before its next change reads it again, even when it arrived already
 * due: a server whose answer stays due can't make the browser ask back to back.
 */
const MIN_REREAD_MS = 60 * 1000;

/**
 * How long until a summary changes on its own, by the server's clock: `nextChangeAt` and `readAt`
 * are the server's times, so what was left at the read less what the browser's clock says passed
 * since it arrived (`receivedAt`). A device set ahead or behind never finds a midnight early or
 * late. Never less than a minute after it arrived; 0 once it's due.
 */
export function getUntilChange(
  { nextChangeAt }: Pick<LearnerSummary, "nextChangeAt">,
  { readAt, receivedAt }: { readAt: number; receivedAt: number },
): number {
  const elapsed = Date.now() - receivedAt;
  const untilChange = nextChangeAt - readAt - elapsed;

  return Math.min(Math.max(untilChange, MIN_REREAD_MS - elapsed, 0), MAX_TIMER_MS);
}

/** Whether the page's own render streams the summary in: its seed marks the head (`meta`). */
export function isSeedExpected(meta: string): boolean {
  return document.querySelector(`meta[name="${meta}"]`) !== null;
}

/**
 * The same learner, or nobody both times: a learner is their user id alone, so signing in again
 * (a new session for the same learner) is never another learner.
 */
export function isSameIdentity(a: LearnerIdentity | null, b: LearnerIdentity | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return a.userId === b.userId;
}

/** The same learner's later snapshot: a higher revision, or the same one read later. */
export function isNewerSummary({
  held,
  next,
}: {
  held: LearnerSummary;
  next: LearnerSummary;
}): boolean {
  if (held.revision !== next.revision) {
    return BigInt(next.revision) > BigInt(held.revision);
  }

  return next.readAt >= held.readAt;
}

/** The browser's one learner store, in memory (see `learner-store.ts`). */
export type LearnerStore = {
  changeTimer: ReturnType<typeof setTimeout> | undefined;
  generation: number;
  inFlight: { generation: number; promise: Promise<void> } | null;
  installed: boolean;
  listeners: Set<() => void>;
  readAt: number;
  receivedAt: number;
  seedTimer: ReturnType<typeof setTimeout> | undefined;
  state: LearnerSummaryState;
  /** The generation of the last identity check, until a read sent since answers: seeds wait. */
  verifying: number | null;
};

/**
 * A write this tab sent for the identity it held (`generation`), and the learner revision it
 * committed for `userId`.
 */
export type LearnerRevisionNote = { generation: number; revision: string; userId: string };

/** Whether the held summary is that learner's, and older than a revision their write committed. */
export function isSummaryBehind(
  state: LearnerSummaryState,
  { revision, userId }: Pick<LearnerRevisionNote, "revision" | "userId">,
): boolean {
  return (
    state.status === "ready" &&
    state.summary.identity.userId === userId &&
    BigInt(state.summary.revision) < BigInt(revision)
  );
}
