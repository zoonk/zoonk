import { type LearnerIdentity, type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import {
  type LearnerStore,
  type LearnerSummaryState,
  type Snapshot,
  getUntilChange,
  isSameIdentity,
} from "./learner-snapshot";
import { fetchLearnerSummary } from "./learner-summary-response";
import { getSessionHint, hasSessionHint } from "./session-hint";

/** Better Auth's own session read drops a stale session hint with the session cookie; the summary's read can't. */
const SESSION_READ_PATH = "/api/auth/get-session";

/** A summary shown again after this long is read again. */
const STALE_ON_RETURN_MS = 2 * 60 * 1000;

export const NOT_LOADED: LearnerSummaryState = { status: "not-loaded" };
const VISITOR: LearnerSummaryState = { status: "visitor" };
const FAILED: LearnerSummaryState = { status: "failed" };

/** `generation` changes whenever the identity held changes, so a read sent for an earlier one never lands. */
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

function getHeldIdentity(): LearnerIdentity | null | undefined {
  if (store.state.status === "ready") {
    return store.state.summary.identity;
  }

  return store.state.status === "visitor" ? null : undefined;
}

function isNewerSnapshot(snapshot: Snapshot): boolean {
  return snapshot.readAt >= store.readAt;
}

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

/** The same read again (a page's cached seed) keeps the time it first arrived. */
function hold(snapshot: Snapshot) {
  store.state = snapshot.summary ? { status: "ready", summary: snapshot.summary } : VISITOR;
  store.receivedAt = snapshot.readAt === store.readAt ? store.receivedAt : Date.now();
  store.readAt = snapshot.readAt;
  scheduleNextChange(snapshot.summary);
  notify();
}

function replaceIdentity(snapshot: Snapshot) {
  store.generation += 1;
  hold(snapshot);
}

/** A page's seed can be an old render the router kept, so it replaces a confirmed identity only through a fresh read. */
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
 * `verify` supersedes every read sent before it, whose cookies may be another learner's, and seeds
 * wait until a read sent since answers.
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
        accept(snapshot, { fresh: true });

        // A hint kept from a session that ended goes, so the next page isn't drawn as signed in.
        if (!snapshot.summary && hasSessionHint()) {
          void fetch(SESSION_READ_PATH)
            .then((response) => response.text())
            .catch(() => null);
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

function guessVisitor() {
  accept({ readAt: 0, source: "guess", summary: null }, { fresh: false });
}

/** A browser the hint says nothing about asks once, and the answer sets the hint. */
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

export function install() {
  if (store.installed) {
    return;
  }

  store.installed = true;
  document.addEventListener("visibilitychange", onVisible);
}
