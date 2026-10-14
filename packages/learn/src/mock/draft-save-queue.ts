/**
 * Where the answers' saves stand: every one stored (`saved`), some on their way (`saving`), some
 * waiting to go out again after a request that couldn't reach the server (`retrying`), or one the
 * server turned down (`refused`, such as an answer sent after the section's time ran out), which
 * holds until a later answer is stored.
 */
export type DraftSaveStatus = "refused" | "retrying" | "saved" | "saving";

/** Runs `run` after `ms`; returns a way to cancel it. Tests pass their own to control time. */
type Schedule = (run: () => void, ms: number) => () => void;

/** The wait before the first new try after a failed request; each next one doubles, up to the last. */
const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 15_000;
const RETRY_BACKOFF = 2;

const scheduleTimeout: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

function getRetryDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * RETRY_BACKOFF ** attempt, LONGEST_RETRY_MS);
}

/**
 * Sends a mock's answers one after another, so an older answer to a question never lands after a
 * newer one, and never drops one: a request that couldn't reach the server (it rejects) is tried
 * again with growing waits (or at once with `retryNow`, when the connection is back), before
 * anything after it. A newer answer to a question waiting to go out replaces the older one, since
 * each answer holds everything about its question. A refused save (`save` resolves false) isn't
 * tried again: nothing would change. `idle` waits for every answer, which is what handing a
 * section in needs.
 */
export function createDraftSaveQueue<TDraft>({
  keyOf,
  onStatus,
  save,
  schedule = scheduleTimeout,
}: {
  /** The question an answer is to: a newer answer to it replaces one still waiting. */
  keyOf: (draft: TDraft) => string;
  onStatus: (status: DraftSaveStatus) => void;
  /** Stores one answer: true once stored, false when refused; rejects when it didn't get through. */
  save: (draft: TDraft) => Promise<boolean>;
  schedule?: Schedule;
}) {
  const waiting: TDraft[] = [];
  const idleWaiters: (() => void)[] = [];
  let sending = false;
  let attempt = 0;
  let refused = false;
  let cancelRetry: (() => void) | null = null;

  function getStatus(): DraftSaveStatus {
    if (cancelRetry) {
      return "retrying";
    }

    if (sending || waiting.length > 0) {
      return "saving";
    }

    return refused ? "refused" : "saved";
  }

  function isBusy() {
    return sending || waiting.length > 0;
  }

  function settle() {
    onStatus(getStatus());

    if (!isBusy()) {
      idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }

  /** Keeps a draft that didn't get through first in line, unless a newer one replaced it. */
  function keepForRetry(draft: TDraft) {
    const key = keyOf(draft);

    if (!waiting.some((other) => keyOf(other) === key)) {
      waiting.unshift(draft);
    }
  }

  function scheduleRetry() {
    const delay = getRetryDelay(attempt);
    attempt += 1;

    cancelRetry = schedule(() => {
      cancelRetry = null;
      void sendNext();
    }, delay);
  }

  async function sendNext(): Promise<void> {
    const draft = waiting.shift();

    if (sending || cancelRetry || draft === undefined) {
      if (draft !== undefined) {
        waiting.unshift(draft);
      }

      settle();
      return;
    }

    sending = true;
    settle();

    const stored = await save(draft).then(
      (ok) => ok,
      () => null,
    );

    sending = false;

    if (stored === null) {
      keepForRetry(draft);
      scheduleRetry();
      settle();
      return;
    }

    attempt = 0;
    refused = !stored;
    await sendNext();
  }

  return {
    /** Sends an answer after the ones before it, replacing one to its question still waiting. */
    add(draft: TDraft) {
      const key = keyOf(draft);
      const index = waiting.findIndex((other) => keyOf(other) === key);

      if (index === -1) {
        waiting.push(draft);
      } else {
        waiting[index] = draft;
      }

      void sendNext();
    },
    /** Resolves once every answer given so far is stored or refused. */
    idle(): Promise<void> {
      if (!isBusy()) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
    /** Whether an answer is still waiting or on its way. */
    isBusy,
    /** Tries the waiting answers again now (the connection is back, or the learner asked to). */
    retryNow() {
      if (!cancelRetry) {
        return;
      }

      cancelRetry();
      cancelRetry = null;
      void sendNext();
    },
  };
}
