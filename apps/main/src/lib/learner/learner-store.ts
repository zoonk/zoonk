import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import {
  type LearnerSummarySeedValue,
  type LearnerSummaryState,
  getUntilChange,
  isSeedExpected,
} from "./learner-snapshot";
import {
  NOT_LOADED,
  accept,
  fail,
  install,
  readLearnerSummary,
  readOrGuess,
  store,
} from "./learner-summary-core";
import { getSessionHint, hasSessionHint } from "./session-hint";

export const LEARNER_SEED_META = "zoonk-learner-seed";

const SEED_WAIT_MS = 10_000;

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

export function ensureLearnerSummary(): void {
  if (typeof document === "undefined") {
    return;
  }

  install();

  const { state } = store;

  if (state.status === "not-loaded") {
    if (isSeedExpected(LEARNER_SEED_META)) {
      waitForSeed();
      return;
    }

    readOrGuess();
    return;
  }

  if (state.status === "ready" && getUntilChange(state.summary, store) === 0) {
    void readLearnerSummary();
    return;
  }

  if (
    (state.status === "visitor" && hasSessionHint()) ||
    (state.status === "failed" && getSessionHint() !== "none")
  ) {
    void readLearnerSummary();
  }
}

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

export function getLearnerGeneration(): number {
  return store.generation;
}

/**
 * Takes it only for the identity held when the action was sent (`generation`), so an old session's
 * cookies never restore it.
 */
export function mergeLearnerSummary({
  generation,
  summary,
}: {
  generation: number;
  summary: LearnerSummary | null;
}): void {
  if (!summary) {
    return;
  }

  if (generation === store.generation) {
    accept({ readAt: summary.readAt, source: "server", summary }, { fresh: false });
  } else {
    void readLearnerSummary({ verify: true });
  }
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
