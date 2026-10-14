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
