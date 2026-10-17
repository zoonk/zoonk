import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import {
  type LearnerViewCopy,
  type LearnerViewKind,
  type LearnerViewRead,
  type LearnerViewResponse,
  type ViewFreshness,
} from "./learner-view-copies";

/** A screen reading one of its views, and what it does with the answer. */
export type ViewRead = {
  kind: LearnerViewKind;
  onResponse: (response: LearnerViewResponse<unknown>) => void;
};

type ViewReadState = {
  /** A signal arrived while it was out: the screens showing the view check again once it's back. */
  again: boolean;
  generation: number;
  promise: Promise<LearnerViewRead>;
  /** Every screen waiting on it: the one that sent it and each that joined it since. */
  responders: Set<ViewRead["onResponse"]>;
  /** The newest signal it covers. */
  sentSeq: number;
};

type LearnerViewsStore = {
  channel: BroadcastChannel | null;
  /** The last read of each view that answered: the newest signal it covers, for its generation. */
  covered: Map<LearnerViewKind, { generation: number; seq: number }>;
  freshness: ViewFreshness;
  /**
   * The newest copy of each view, for the identity generation that read or showed it, and when a
   * read of this tab brought it (the browser's time; none for the page's own copy).
   */
  held: Map<
    LearnerViewKind,
    { copy: LearnerViewCopy<unknown>; generation: number; receivedAt: number | null }
  >;
  installed: boolean;
  /** When each view's last read was sent (the browser's time), so a show never reads twice at once. */
  lastSentAt: Map<LearnerViewKind, number>;
  lastSummary: LearnerSummary | null;
  listeners: Set<() => void>;
  reads: Map<LearnerViewKind, ViewReadState>;
  /** The ready copy each screen was last answered with, by a read or the held copy: told once. */
  recovered: WeakMap<ViewRead["onResponse"], LearnerViewCopy<unknown>>;
};

const NO_SIGNALS: ViewFreshness = {
  contentSeq: 0,
  daySeq: 0,
  deadlineSeq: 0,
  seq: 0,
  unknownWriteSeq: 0,
  watermark: null,
};

/** Memory only, per tab: a reload reads its views again with its page. */
export const store: LearnerViewsStore = {
  channel: null,
  covered: new Map(),
  freshness: NO_SIGNALS,
  held: new Map(),
  installed: false,
  lastSentAt: new Map(),
  lastSummary: null,
  listeners: new Set(),
  reads: new Map(),
  recovered: new WeakMap(),
};

export function notify() {
  store.listeners.forEach((listener) => listener());
}

/** Records a signal: every read sent before it no longer covers it. */
export function signal(field: Exclude<keyof ViewFreshness, "seq" | "watermark">) {
  const seq = store.freshness.seq + 1;
  store.freshness = { ...store.freshness, [field]: seq, seq };
}

/** Raises the highest revision the tab knows the learner's writes committed, if this one is higher. */
export function raiseWatermark({
  revision,
  userId,
}: {
  revision: string;
  userId: string;
}): boolean {
  const next = BigInt(revision);
  const { watermark } = store.freshness;

  if (watermark && watermark.userId === userId && watermark.revision >= next) {
    return false;
  }

  const seq = store.freshness.seq + 1;
  store.freshness = { ...store.freshness, seq, watermark: { revision: next, seq, userId } };
  return true;
}
