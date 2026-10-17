import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { safeAsync } from "@zoonk/utils/error";
import { checkIdentity, onLearnerIdentityChange } from "./learner-identity";
import { type LearnerRevisionNote } from "./learner-snapshot";
import {
  catchUpLearnerSummary,
  getHeldLearnerId,
  getLearnerGeneration,
  getLearnerSummaryState,
  subscribeToLearnerSummary,
} from "./learner-store";
import {
  type LearnerViewCopy,
  type LearnerViewKind,
  type LearnerViewRead,
  type LearnerViewStamp,
  isViewOld,
  pickNewerView,
} from "./learner-view-copies";
import { fetchLearnerView } from "./learner-view-response";
import {
  NO_SIGNALS,
  type ViewRead,
  notify,
  raiseWatermark,
  signal,
  store,
} from "./learner-views-state";
import { isShownCopyStale } from "./legacy-shown-copy";

const CHANNEL_NAME = "zoonk-learner-views";

type ChannelMessage = { revision: string | null; userId: string; wrote: boolean };

function getHeldSummary(): LearnerSummary | null {
  const state = getLearnerSummaryState();
  return state.status === "ready" ? state.summary : null;
}

/**
 * Whether a copy is for the learner the browser holds: any copy while it doesn't know who that is
 * yet (the page's own render, before the summary arrives), else only theirs. A copy the router
 * rendered for whoever held the session before (another tab signed out, or in as someone else) is
 * never shown or kept.
 */
export function isForHeldLearner(userId: string): boolean {
  const held = getHeldLearnerId();
  return held === undefined || held === userId;
}

function getDayKey(summary: LearnerSummary | null): string | null {
  return summary?.day ? `${summary.day.goalId}:${summary.day.localDate}` : null;
}

/**
 * The summary changed: its revision is one the learner's writes reached, a summary read past the
 * last one's deadline (midnight, a plan's or a session's end) makes the views old, and so does one
 * naming another study day.
 */
function onSummary() {
  const summary = getHeldSummary();
  const previous = store.lastSummary;

  if (summary === previous) {
    return;
  }

  store.lastSummary = summary;

  if (!summary) {
    return;
  }

  raiseWatermark({ revision: summary.revision, userId: summary.identity.userId });

  if (previous && summary.readAt >= previous.nextChangeAt) {
    signal("deadlineSeq");
  }

  if (getDayKey(summary) !== getDayKey(previous)) {
    signal("daySeq");
  }

  notify();
}

/** Another learner (or nobody) took the session: nothing held for the one before is shown again. */
function onIdentityChange() {
  store.held.clear();
  store.reads.clear();
  store.covered.clear();
  store.lastSentAt.clear();
  store.freshness = { ...NO_SIGNALS, seq: store.freshness.seq };
  notify();
}

/** Another tab of the same learner wrote: its revision, or a write whose revision it doesn't know. */
function onChannelMessage(event: MessageEvent<ChannelMessage>) {
  if (getHeldSummary()?.identity.userId !== event.data.userId) {
    return;
  }

  const raised = event.data.revision
    ? raiseWatermark({ revision: event.data.revision, userId: event.data.userId })
    : false;

  if (event.data.wrote) {
    signal("unknownWriteSeq");
  }

  if (raised || event.data.wrote) {
    notify();
  }
}

function install() {
  if (store.installed || typeof document === "undefined") {
    return;
  }

  store.installed = true;
  subscribeToLearnerSummary(onSummary);
  onLearnerIdentityChange(onIdentityChange);
  onSummary();

  if ("BroadcastChannel" in globalThis) {
    store.channel = new BroadcastChannel(CHANNEL_NAME);
    store.channel.addEventListener("message", onChannelMessage);
  }
}

/**
 * Takes the learner revision a write left (the open's outcome): every shown view older than it is
 * read again once it's on screen. Only for the identity the browser held when the write was sent.
 */
export function noteLearnerRevision({ generation, revision, userId }: LearnerRevisionNote): void {
  install();

  if (generation !== getLearnerGeneration()) {
    return;
  }

  // The summary moves on its own reads: it catches up even when the views already heard of it.
  catchUpLearnerSummary({ generation, revision, userId });

  if (!raiseWatermark({ revision, userId })) {
    return;
  }

  store.channel?.postMessage({ revision, userId, wrote: false } satisfies ChannelMessage);
  notify();
}

/**
 * Notes a write whose revision the tab doesn't know yet (a block's start, the day's end): each view
 * on screen, or shown later, is read again once.
 */
export function noteLearnerWrite({ generation }: { generation: number }): void {
  install();

  if (generation !== getLearnerGeneration()) {
    return;
  }

  signal("unknownWriteSeq");
  const userId = getHeldSummary()?.identity.userId;

  if (userId) {
    store.channel?.postMessage({ revision: null, userId, wrote: true } satisfies ChannelMessage);
  }

  notify();
}

/** A page that no longer belongs to the learner the browser holds goes no further (`checkIdentity`). */
function assertPageIsTheLearners() {
  if (!checkIdentity()) {
    throw new Error("The page no longer belongs to the learner the browser holds");
  }
}

/**
 * Runs a write whose answer doesn't name the learner's new revision and, once it saved (`saved`;
 * by default a truthy answer), notes it for the identity it started under (`noteLearnerWrite`): the
 * views on screen read themselves again once, never a page refresh. A refused, unchanged or failed
 * write notes nothing. A page that no longer belongs to the learner the browser holds sends
 * nothing and takes no answer: the write fails (the page is covered, reloading).
 */
export async function withLearnerWrite<Result>(
  write: () => Promise<Result>,
  saved: (result: Result) => boolean = Boolean,
): Promise<Result> {
  const generation = getLearnerGeneration();

  // Checked right before it's sent (after any await of the caller's) and as its answer arrives.
  assertPageIsTheLearners();
  const result = await write();
  assertPageIsTheLearners();

  if (saved(result)) {
    noteLearnerWrite({ generation });
  }

  return result;
}

/** The newest copy of a view this tab read, for the identity it holds now. */
export function getHeldLearnerView(kind: LearnerViewKind): LearnerViewCopy<unknown> | null {
  const held = store.held.get(kind);

  return held && held.generation === getLearnerGeneration() && isForHeldLearner(held.copy.userId)
    ? held.copy
    : null;
}

/**
 * Keeps a copy the page rendered or a read brought (`receivedAt`, when a read of this tab brought
 * it): an older one never replaces a newer one.
 */
export function holdLearnerView(
  kind: LearnerViewKind,
  copy: LearnerViewCopy<unknown>,
  receivedAt: number | null = null,
): void {
  install();

  if (!isForHeldLearner(copy.userId)) {
    return;
  }

  // A read's revision is one the learner's writes reached: it can only raise what's known.
  raiseWatermark({ revision: copy.revision, userId: copy.userId });

  const held = getHeldLearnerView(kind);

  if (pickNewerView(copy, held) === copy && copy !== held) {
    store.held.set(kind, { copy, generation: getLearnerGeneration(), receivedAt });
    notify();
  }
}

export function subscribeToLearnerViews(listener: () => void): () => void {
  install();
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/**
 * Reads a view, once at a time per view and identity. The read covers every signal the tab had
 * when it was sent: once it answers for the same identity, its copy replaces an older one and the
 * screen gets the answer (`onResponse`, which can say the page shows another state now). A read
 * sent before the identity changed, or answering for someone else, lands nowhere. One that failed
 * covers nothing, so the next show or signal reads again. A signal arriving while it's out makes
 * the showing screens check again once it's back.
 */
function sendViewRead({ kind, onResponse }: ViewRead): Promise<LearnerViewRead> {
  const sent = { generation: getLearnerGeneration(), seq: store.freshness.seq };
  const responders = new Set([onResponse]);
  store.lastSentAt.set(kind, Date.now());

  async function readAndHold(): Promise<LearnerViewRead> {
    const { data: response } = await safeAsync(() => fetchLearnerView(kind));

    // Nothing answered (the read covers nothing, so the next show or signal reads again), or it
    // answered for an identity the tab no longer holds.
    if (
      !response ||
      sent.generation !== getLearnerGeneration() ||
      !checkIdentity() ||
      (response.status === "ready" && !isForHeldLearner(response.copy.userId))
    ) {
      return "failed";
    }

    store.covered.set(kind, sent);

    if (response.status === "ready") {
      holdLearnerView(kind, response.copy, Date.now());
    }

    // A ready copy reaches each screen once, though the held copy may have told it already.
    responders.forEach((respond) => {
      if (response.status === "ready" && store.recovered.get(respond) === response.copy) {
        return;
      }

      if (response.status === "ready") {
        store.recovered.set(respond, response.copy);
      }

      respond(response);
    });

    return response.status === "ready" ? "shown" : "elsewhere";
  }

  const promise: Promise<LearnerViewRead> = readAndHold().finally(() => {
    const current = store.reads.get(kind);

    if (current?.promise !== promise) {
      return;
    }

    store.reads.delete(kind);

    if (current.again) {
      notify();
    }
  });

  store.reads.set(kind, {
    again: false,
    generation: sent.generation,
    promise,
    responders,
    sentSeq: sent.seq,
  });

  return promise;
}

/**
 * Reads a view unless a read sent since the latest signal is out already; one sent before it is
 * left to finish, and the screens check again after it.
 */
function readLearnerView(view: ViewRead): Promise<LearnerViewRead> {
  const running = store.reads.get(view.kind);

  if (running?.generation === getLearnerGeneration()) {
    running.again ||= running.sentSeq < store.freshness.seq;
    running.responders.add(view.onResponse);
    return running.promise;
  }

  return sendViewRead(view);
}

/**
 * Reads a shown view again when it's old (`isViewOld`), or, on its screen's show (`show`: it
 * mounted, or the page came back from the browser's history), when it's older than legacy
 * freshness allowed. Nothing reads while the tab is hidden: the next show checks again. Nothing
 * reads for a view of another learner than the one the browser holds: the page reads itself again
 * for them. A screen that draws the copies this tab holds (`drawsHeld`) is judged by the newest
 * one: a copy that just landed, before the screen draws it again, so a listener that runs first
 * never reads again for what that copy shows. A screen showing another state is judged by its own.
 */
/**
 * A page showing another state is out of date once this tab holds a newer ready copy of its view,
 * read before it mounted: it's answered with that copy, once, so it draws itself again.
 */
function answerFromHeld({ kind, onResponse, shown }: ViewRead & { shown: LearnerViewStamp }) {
  const held = store.held.get(kind);

  if (
    !held ||
    held.generation !== getLearnerGeneration() ||
    held.copy.userId !== shown.userId ||
    BigInt(held.copy.revision) <= BigInt(shown.revision) ||
    store.recovered.get(onResponse) === held.copy
  ) {
    return false;
  }

  store.recovered.set(onResponse, held.copy);
  onResponse({ copy: held.copy, status: "ready" });
  return true;
}

export function reconcileLearnerView({
  drawsHeld = false,
  kind,
  onResponse,
  show,
  shown: drawn,
}: ViewRead & {
  drawsHeld?: boolean;
  show: boolean;
  shown: LearnerViewStamp & { readAt?: number };
}): void {
  if (
    document.visibilityState !== "visible" ||
    !isForHeldLearner(drawn.userId) ||
    (!drawsHeld && answerFromHeld({ kind, onResponse, shown: drawn }))
  ) {
    return;
  }

  const covered = store.covered.get(kind);
  const held = store.held.get(kind);

  const shown =
    drawsHeld && held?.generation === getLearnerGeneration()
      ? pickNewerView(drawn, held.copy)
      : drawn;

  const old =
    isViewOld({
      coveredSeq: covered?.generation === getLearnerGeneration() ? covered.seq : 0,
      freshness: store.freshness,
      shown,
      summaryDay: getDayKey(getHeldSummary()),
    }) ||
    (show &&
      shown.readAt !== undefined &&
      isShownCopyStale({
        arrivedAt: held?.copy === shown ? held.receivedAt : null,
        lastSent: store.lastSentAt.get(kind) ?? 0,
        readAt: shown.readAt,
      }));

  if (old) {
    void readLearnerView({ kind, onResponse });
  }
}

/**
 * A read that covers the signal `seq`: one out already that was sent before it is left to finish,
 * then read again; a newer one is joined.
 */
function readCovering(view: ViewRead, seq: number): Promise<LearnerViewRead> {
  const running = store.reads.get(view.kind);

  if (running?.generation !== getLearnerGeneration()) {
    return sendViewRead(view);
  }

  if (running.sentSeq >= seq) {
    running.responders.add(view.onResponse);
    return running.promise;
  }

  running.again = true;
  return running.promise.then(() => readCovering(view, seq));
}

/**
 * Reads a view again now, whatever the signals say: content arriving without a learner write (a
 * lesson written meanwhile), or a write refused as out of date, that the screen asked about. It
 * settles with what a read sent after the ask came to (`LearnerViewRead`).
 */
export function refreshLearnerView(view: ViewRead): Promise<LearnerViewRead> {
  install();
  signal("contentSeq");
  return readCovering(view, store.freshness.seq);
}
