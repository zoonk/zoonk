import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import {
  checkIdentity,
  connectLearnerStore,
  noteSessionAnswer,
  onLearnerIdentityChange,
} from "./learner-identity";
import {
  type LearnerStore,
  type LearnerSummaryState,
  type Snapshot,
  getUntilChange,
  isNewerSummary,
  isSameIdentity,
} from "./learner-snapshot";
import { fetchLearnerSummary } from "./learner-summary-response";
import { getSessionHint } from "./session-hint";

/**
 * The learner summary store's core (`learner-store.ts` is its public face): what the browser holds,
 * its reads and how a read or a page's seed is taken. The identity record (`learner-identity.ts`)
 * says first whether the page may still show what a read brings.
 */

/** A summary shown again after this long is read again (its own freshness, not who it is). */
const STALE_ON_RETURN_MS = 2 * 60 * 1000;

export const NOT_LOADED: LearnerSummaryState = { status: "not-loaded" };
const VISITOR: LearnerSummaryState = { status: "visitor" };
const FAILED: LearnerSummaryState = { status: "failed" };

/**
 * Memory only: a reload or another tab reads its own. `generation` changes whenever the identity
 * held changes, so a read sent for an earlier one never lands. `readAt` is the server's time of
 * the newest snapshot held (0 for the browser's own guess that nobody is signed in), and
 * `receivedAt` the browser's time it arrived.
 */
export const store: LearnerStore = {
  changeTimer: undefined,
  generation: 0,
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
export function getHeldIdentity(): LearnerIdentity | null | undefined {
  if (store.state.status === "ready") {
    return store.state.summary.identity;
  }

  return store.state.status === "visitor" ? null : undefined;
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

  const wait = getUntilChange(summary, store);

  store.changeTimer = setTimeout(() => {
    if (store.listeners.size > 0) {
      void readLearnerSummary();
    }
  }, wait);
}

/** Holds a snapshot; the same read again (a page's cached seed) keeps the time it first arrived. */
function hold(snapshot: Snapshot) {
  store.state = snapshot.summary ? { status: "ready", summary: snapshot.summary } : VISITOR;
  store.receivedAt = snapshot.readAt === store.readAt ? store.receivedAt : Date.now();
  store.readAt = snapshot.readAt;
  scheduleNextChange(snapshot.summary);
  notify();
}

/**
 * Another learner (or nobody) replaced the one held: the held summary is dropped with every read
 * still on its way for it. Whether the page may show them was decided before (`learner-identity`).
 */
function replaceIdentity(snapshot: Snapshot) {
  store.generation += 1;
  hold(snapshot);
}

/**
 * Takes a snapshot when it's the held learner's newer one, or the server's word that someone else
 * (or nobody) holds the session now: a read the browser sent for the current generation, with the
 * cookies of now. A page's seed can be an old render the router kept (or a render that left before
 * another tab signed in), so it replaces a confirmed identity only through a fresh read.
 */
export function accept(snapshot: Snapshot, { fresh }: { fresh: boolean }) {
  const held = getHeldIdentity();
  const next = snapshot.summary?.identity ?? null;

  if (held === undefined) {
    // A page's seed is rendered after any read already out was sent, so its cookies are the newer
    // ones: that read (perhaps another learner's) lands nowhere.
    if (!fresh && snapshot.source === "server" && store.inFlight?.generation === store.generation) {
      store.generation += 1;
    }

    hold(snapshot);
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

export function fail() {
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
export function readLearnerSummary({ verify = false }: { verify?: boolean } = {}): Promise<void> {
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
        if (store.generation !== sent) {
          return;
        }

        store.verifying = null;

        // Whose session the read found is decided before it's held: another learner than the page
        // was drawn for is never drawn.
        noteSessionAnswer(snapshot.tag);

        if (checkIdentity()) {
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
    });

  store.inFlight = { generation: sent, promise };
  return promise;
}

/** Without a session nobody needs reading: the browser's own guess, which any read replaces. */
function guessVisitor() {
  accept({ readAt: 0, source: "guess", summary: null, tag: null }, { fresh: false });
}

/**
 * A browser the hint says has no session is a visitor without asking; one it says nothing about (a
 * session from before the hint, or a new browser) asks once, and the answer sets the hint.
 */
export function readOrGuess({ verify = false }: { verify?: boolean } = {}) {
  if (getSessionHint() === "none") {
    guessVisitor();
    return;
  }

  void readLearnerSummary({ verify });
}

function isStale(summary: LearnerSummary, olderThanMs: number): boolean {
  return getUntilChange(summary, store) === 0 || Date.now() - store.receivedAt > olderThanMs;
}

/** A page shown again: a stale summary, or a failed read while the browser holds a session. */
function onVisible() {
  if (document.visibilityState !== "visible" || store.listeners.size === 0 || !checkIdentity()) {
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

export function install() {
  if (store.installed) {
    return;
  }

  store.installed = true;
  document.addEventListener("visibilitychange", onVisible);

  // A page held for nobody now shows someone's: the summary is read for them.
  onLearnerIdentityChange(() => {
    void readLearnerSummary({ verify: true });
  });
}

// This tab's own auth change: every read and seed of before stops counting, and seeds wait until a
// read sent since answers.
connectLearnerStore(() => {
  store.generation += 1;
  store.verifying = store.generation;
});
