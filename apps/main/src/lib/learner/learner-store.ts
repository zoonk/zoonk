import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import {
  type LearnerSummarySeedValue,
  type LearnerSummaryState,
  type Snapshot,
  isNewerSummary,
  isSameIdentity,
  reconcileSessionHint,
  syncSessionHint,
} from "./learner-snapshot";
import { fetchLearnerSummary } from "./learner-summary-response";
import { getSessionHint, hasSessionHint } from "./session-hint";

/** A page whose render streams the summary in (`LearnerSummarySeed`) marks it in the head. */
export const LEARNER_SEED_META = "zoonk-learner-seed";

/** How long a page's seed may take before the browser reads the summary itself. */
const SEED_WAIT_MS = 10_000;

/** A summary older than this is read again when its tab is shown again. */
const STALE_ON_RETURN_MS = 2 * 60 * 1000;

/** A timer longer than a day isn't needed: the summary changes at the learner's midnight. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

const CHANNEL_NAME = "zoonk-learner";

const NOT_LOADED: LearnerSummaryState = { status: "not-loaded" };
const VISITOR: LearnerSummaryState = { status: "visitor" };
const FAILED: LearnerSummaryState = { status: "failed" };

type LearnerStore = {
  changeTimer: ReturnType<typeof setTimeout> | undefined;
  channel: BroadcastChannel | null;
  generation: number;
  identityListeners: Set<() => void>;
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
 * Memory only: a reload or another tab reads its own. `generation` changes whenever the identity
 * held changes, so a read sent for an earlier one never lands. `readAt` is the server's time of
 * the newest snapshot held (0 for the browser's own guess that nobody is signed in), and
 * `receivedAt` the browser's time it arrived.
 */
const store: LearnerStore = {
  changeTimer: undefined,
  channel: null,
  generation: 0,
  identityListeners: new Set(),
  inFlight: null,
  installed: false,
  listeners: new Set(),
  readAt: 0,
  receivedAt: 0,
  seedTimer: undefined,
  state: NOT_LOADED,
  verifying: null,
};

function notify() {
  store.listeners.forEach((listener) => listener());
}

/** The identity held: undefined while unknown, null for a visitor. */
function getHeldIdentity(): LearnerIdentity | null | undefined {
  if (store.state.status === "ready") {
    return store.state.summary.identity;
  }

  return store.state.status === "visitor" ? null : undefined;
}

/** Tells the other tabs whose session the server read, so a tab holding another one reads again. */
function announce(snapshot: Snapshot) {
  if (snapshot.readAt > 0) {
    store.channel?.postMessage({ identity: snapshot.summary?.identity ?? null });
  }
}

/** A later snapshot of the identity held: the learner's newer summary, or nobody read again. */
function isNewerSnapshot(snapshot: Snapshot): boolean {
  if (store.state.status === "ready" && snapshot.summary) {
    return isNewerSummary({ held: store.state.summary, next: snapshot.summary });
  }

  return snapshot.readAt >= store.readAt;
}

/** Reads the summary again at its next change (midnight, the plan's or the session's end). */
function scheduleNextChange(summary: LearnerSummary | null) {
  clearTimeout(store.changeTimer);

  if (!summary) {
    return;
  }

  const wait = Math.min(Math.max(summary.nextChangeAt - Date.now(), 0), MAX_TIMER_MS);

  store.changeTimer = setTimeout(() => {
    if (store.listeners.size > 0) {
      void readLearnerSummary();
    }
  }, wait);
}

function hold(snapshot: Snapshot) {
  store.state = snapshot.summary ? { status: "ready", summary: snapshot.summary } : VISITOR;
  store.readAt = snapshot.readAt;
  store.receivedAt = Date.now();
  syncSessionHint(snapshot);
  scheduleNextChange(snapshot.summary);
  notify();
}

/**
 * Another learner (or nobody) replaced the one held: the held summary is dropped with every read
 * still on its way for it, and the pages that showed the old one read themselves again.
 */
function replaceIdentity(snapshot: Snapshot) {
  const confirmed = store.readAt > 0 && store.state.status === "ready";

  store.generation += 1;
  hold(snapshot);
  announce(snapshot);

  if (confirmed) {
    store.identityListeners.forEach((listener) => listener());
  }
}

/**
 * Takes a snapshot when it's the held learner's newer one, or the server's word that someone else
 * (or nobody) holds the session now: a read the browser sent for the current generation, with the
 * cookies of now. A page's seed can be an old render the router kept (or a render that left before
 * another tab signed in), so it replaces a confirmed identity only through a fresh read.
 */
function accept(snapshot: Snapshot, { fresh }: { fresh: boolean }) {
  const held = getHeldIdentity();
  const next = snapshot.summary?.identity ?? null;

  if (held === undefined) {
    // A page's seed is rendered after any read already out was sent, so its cookies are the newer
    // ones: that read (perhaps another learner's) lands nowhere.
    if (!fresh && snapshot.source === "server" && store.inFlight?.generation === store.generation) {
      store.generation += 1;
    }

    hold(snapshot);
    announce(snapshot);
    return;
  }

  if (isSameIdentity(held, next)) {
    if (isNewerSnapshot(snapshot)) {
      hold(snapshot);
    }

    return;
  }

  if (fresh) {
    replaceIdentity(snapshot);
    return;
  }

  if (store.readAt > 0) {
    void readLearnerSummary({ verify: true });
    return;
  }

  replaceIdentity(snapshot);
}

function fail() {
  if (store.state.status === "not-loaded") {
    store.state = FAILED;
    notify();
  }
}

/**
 * Reads the summary from the server, once at a time for the identity held: a read sent before the
 * identity changed lands nowhere, so it can neither restore nor clear the newer one. A check of who
 * holds the session now (`verify`) supersedes every read sent before it, whose cookies may be
 * another learner's, and seeds wait until a read sent since answers.
 */
function readLearnerSummary({ verify = false }: { verify?: boolean } = {}): Promise<void> {
  if (!verify && store.inFlight?.generation === store.generation) {
    return store.inFlight.promise;
  }

  if (verify) {
    store.generation += 1;
    store.verifying = store.generation;
  }

  const sent = store.generation;

  const promise = fetchLearnerSummary()
    .then(
      (snapshot) => {
        if (store.generation === sent) {
          store.verifying = null;
          accept(snapshot, { fresh: true });
        }
      },
      () => {
        if (store.generation === sent) {
          fail();
        }
      },
    )
    .finally(() => {
      if (store.inFlight?.promise === promise) {
        store.inFlight = null;
      }

      // A response this read discarded may still have set or dropped the hint (its header).
      reconcileSessionHint(store.state);
    });

  store.inFlight = { generation: sent, promise };
  return promise;
}

function isSeedExpected(): boolean {
  return document.querySelector(`meta[name="${LEARNER_SEED_META}"]`) !== null;
}

/** Without a session nobody needs reading: the browser's own guess, which any read replaces. */
function guessVisitor() {
  accept({ readAt: 0, source: "guess", summary: null }, { fresh: false });
}

/**
 * A browser the hint says has no session is a visitor without asking; one it says nothing about (a
 * session from before the hint, or a new browser) asks once, and the answer sets the hint.
 */
function readOrGuess({ verify = false }: { verify?: boolean } = {}) {
  if (getSessionHint() === "none") {
    guessVisitor();
    return;
  }

  void readLearnerSummary({ verify });
}

/**
 * The page's own render streams the summary in; the browser reads it only if that never comes. That
 * read is sent after the page's request, so a seed arriving late can't settle who it is.
 */
function waitForSeed() {
  if (store.seedTimer !== undefined) {
    return;
  }

  store.seedTimer = setTimeout(() => {
    if (store.state.status === "not-loaded") {
      readOrGuess({ verify: true });
    }
  }, SEED_WAIT_MS);
}

function isStale(summary: LearnerSummary, olderThanMs: number): boolean {
  return Date.now() >= summary.nextChangeAt || Date.now() - store.receivedAt > olderThanMs;
}

function onVisible() {
  if (document.visibilityState !== "visible" || store.listeners.size === 0) {
    return;
  }

  if (store.state.status === "ready" && isStale(store.state.summary, STALE_ON_RETURN_MS)) {
    void readLearnerSummary();
    return;
  }

  if (store.state.status === "failed" && getSessionHint() !== "none") {
    void readLearnerSummary();
  }
}

/**
 * Another tab's learner differs from the one held here, or none is held yet (a read or the page's
 * seed may still be on its way, with the cookies of before): a check reads who it is now.
 */
function onIdentityMessage(event: MessageEvent<{ identity: LearnerIdentity | null }>) {
  const held = getHeldIdentity();

  if (held !== undefined && isSameIdentity(held, event.data.identity)) {
    return;
  }

  void readLearnerSummary({ verify: true });
}

function install() {
  if (store.installed) {
    return;
  }

  store.installed = true;
  document.addEventListener("visibilitychange", onVisible);

  if ("BroadcastChannel" in globalThis) {
    store.channel = new BroadcastChannel(CHANNEL_NAME);
    store.channel.addEventListener("message", onIdentityMessage);
  }
}

/**
 * Makes sure the summary is (being) read, for something that shows it: the page's seed when one is
 * on its way, a read when the browser holds a session, or the visitor's look otherwise. A summary
 * is read again once it changes on its own (`nextChangeAt`), and a failed read on the next try.
 */
export function ensureLearnerSummary(): void {
  if (typeof document === "undefined") {
    return;
  }

  install();

  const { state } = store;

  if (state.status === "not-loaded") {
    if (isSeedExpected()) {
      waitForSeed();
      return;
    }

    readOrGuess();
    return;
  }

  if (state.status === "ready" && Date.now() >= state.summary.nextChangeAt) {
    void readLearnerSummary();
    return;
  }

  // A visitor who became a guest has a session to read now; a failed read tries again.
  if (
    (state.status === "visitor" && hasSessionHint()) ||
    (state.status === "failed" && getSessionHint() !== "none")
  ) {
    void readLearnerSummary();
  }
}

/** Takes what a page's server render read (`LearnerSummarySeed`). */
export function mergeLearnerSummarySeed(seed: LearnerSummarySeedValue): void {
  install();

  // Who holds the session is being checked: only a read settles it (asked again if it failed).
  if (store.verifying !== null) {
    if (store.inFlight === null) {
      void readLearnerSummary({ verify: true });
    }

    return;
  }

  if (seed.status === "failed") {
    fail();
    return;
  }

  if (seed.status === "visitor") {
    accept({ readAt: 0, source: "server", summary: null }, { fresh: false });
    return;
  }

  accept(
    { readAt: seed.summary.readAt, source: "server", summary: seed.summary },
    { fresh: false },
  );
}

/** The identity's generation now, to tell later whether it changed while a request was out. */
export function getLearnerGeneration(): number {
  return store.generation;
}

/**
 * Takes a summary a Server Action returned with its outcome (a goal switch) for the identity the
 * browser held when it sent the action (`generation`), so an old session's cookies never restore
 * it; when the session was checked meanwhile, the summary is read again with the cookies of now.
 */
export function mergeLearnerSummary({
  generation,
  summary,
}: {
  generation: number;
  summary: LearnerSummary | null;
}): void {
  if (summary && generation === store.generation) {
    accept({ readAt: summary.readAt, source: "server", summary }, { fresh: false });
  } else if (summary) {
    void readLearnerSummary({ verify: true });
  }
}

/**
 * Tells the other tabs this browser is signing out (the session ends for all of them), so each
 * reads again and drops what it held, before this one leaves for the home page.
 */
export function announceSignOut(): void {
  install();
  store.channel?.postMessage({ identity: null });
}

export function getLearnerSummaryState(): LearnerSummaryState {
  return store.state;
}

export function getServerLearnerSummaryState(): LearnerSummaryState {
  return NOT_LOADED;
}

export function subscribeToLearnerSummary(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/** Runs when the identity the pages showed changed: they read themselves again. */
export function onLearnerIdentityChange(listener: () => void): () => void {
  store.identityListeners.add(listener);
  return () => store.identityListeners.delete(listener);
}
