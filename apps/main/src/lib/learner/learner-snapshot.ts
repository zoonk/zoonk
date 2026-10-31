import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";

export type Snapshot = {
  readAt: number;
  source: "guess" | "server";
  summary: LearnerSummary | null;
};

/** A failed read shows the frame's neutral look, never made-up data. */
export type LearnerSummaryState =
  | { status: "failed" }
  | { status: "not-loaded" }
  | { status: "ready"; summary: LearnerSummary }
  | { status: "visitor" };

export type LearnerSummarySeedValue =
  | { status: "failed" }
  | { status: "ready"; summary: LearnerSummary }
  | { status: "visitor" };

/** The summary changes at least at the learner's midnight. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/** A server whose answer stays due can't make the browser ask back to back. */
const MIN_REREAD_MS = 60 * 1000;

/** By the server's clock, so a device set ahead or behind never finds a midnight early or late. */
export function getUntilChange(
  { nextChangeAt }: Pick<LearnerSummary, "nextChangeAt">,
  { readAt, receivedAt }: { readAt: number; receivedAt: number },
): number {
  const elapsed = Date.now() - receivedAt;
  const untilChange = nextChangeAt - readAt - elapsed;

  return Math.min(Math.max(untilChange, MIN_REREAD_MS - elapsed, 0), MAX_TIMER_MS);
}

export function isSeedExpected(meta: string): boolean {
  return document.querySelector(`meta[name="${meta}"]`) !== null;
}

/** By user id alone, so a new session for the same learner is never another learner. */
export function isSameIdentity(a: LearnerIdentity | null, b: LearnerIdentity | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return a.userId === b.userId;
}

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
