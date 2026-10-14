import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { getSessionHint, hasSessionHint, setNoSessionHint, setSessionHint } from "./session-hint";

/**
 * A read of the server's (`server`) or the browser's own guess that nobody is signed in (no
 * session hint): the learner's summary or nobody, and when it was read.
 */
export type Snapshot = {
  readAt: number;
  source: "guess" | "server";
  summary: LearnerSummary | null;
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
  | { status: "ready"; summary: LearnerSummary }
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

export function isSameIdentity(a: LearnerIdentity | null, b: LearnerIdentity | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return a.userId === b.userId && a.signedInAt === b.signedInAt;
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

/**
 * Keeps the session hint in step with what the server read: a session gets it until its latest end
 * (a first sign-in the hint missed, or a session renewed since), and a browser without a session
 * (signed out, or its session ended) gets "none", so its pages stop reading for nobody.
 */
export function syncSessionHint(snapshot: Snapshot) {
  if (snapshot.source !== "server") {
    return;
  }

  if (snapshot.summary) {
    void setSessionHint(snapshot.summary.identity.expiresAt);
    return;
  }

  if (getSessionHint() !== "none") {
    void setNoSessionHint();
  }
}

/**
 * Puts the hint back for the learner held when a read's response dropped it after another tab
 * signed in (a late "visitor" answer the store discarded still carried its header).
 */
export function reconcileSessionHint(state: { status: string; summary?: LearnerSummary }) {
  if (state.status === "ready" && state.summary && !hasSessionHint()) {
    void setSessionHint(state.summary.identity.expiresAt);
  }
}
