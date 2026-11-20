/** `refused` holds until every refused question's answer is stored. */
export type DraftSaveStatus = "refused" | "retrying" | "saved" | "saving";

/** What one save attempt came to; `stopped` when the session ended or changed. */
export type DraftSaveOutcome = "refused" | "saved" | "stopped";

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 15_000;
const RETRY_BACKOFF = 2;

function getRetryDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * RETRY_BACKOFF ** attempt, LONGEST_RETRY_MS);
}

function enqueueDraft<TDraft>(waiting: TDraft[], draft: TDraft, keyOf: (draft: TDraft) => string) {
  const key = keyOf(draft);
  const index = waiting.findIndex((other) => keyOf(other) === key);

  if (index === -1) {
    waiting.push(draft);
  } else {
    waiting[index] = draft;
  }
}

type DraftSaveQueueOptions<TDraft> = {
  keyOf: (draft: TDraft) => string;
  /** A refused answer, or one that didn't get through; it stays failed until it's stored. */
  onFailed: (draft: TDraft) => void;
  /** A permanently refused answer for this mock (locked, time up, or old section). */
  onRefused?: (draft: TDraft) => void;
  onStatus: (status: DraftSaveStatus) => void;
  onStored: (draft: TDraft) => void;
  /** `saved` once stored, `refused` when permanently rejected, `stopped` on session loss; rejects offline. */
  save: (draft: TDraft) => Promise<DraftSaveOutcome>;
};

/**
 * Sends answers in order, so an older answer never lands after a newer one, and retries one that
 * couldn't reach the server before what follows.
 */
export function createDraftSaveQueue<TDraft>({
  keyOf,
  onFailed,
  onRefused,
  onStatus,
  onStored,
  save,
}: DraftSaveQueueOptions<TDraft>) {
  const waiting: TDraft[] = [];
  const idleWaiters: ((flushed: boolean) => void)[] = [];
  let sending: TDraft | null = null;
  let attempt = 0;
  const refused = new Set<string>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let generation = 0;

  function getStatus(): DraftSaveStatus {
    if (retryTimer) {
      return "retrying";
    }

    if (sending !== null || waiting.length > 0) {
      return "saving";
    }

    return refused.size > 0 ? "refused" : "saved";
  }

  function isBusy() {
    return sending !== null || waiting.length > 0;
  }

  function resolveIdle(flushed: boolean) {
    idleWaiters.splice(0).forEach((resolve) => resolve(flushed));
  }

  function settle() {
    onStatus(getStatus());

    if (!isBusy()) {
      resolveIdle(!stopped);
    }
  }

  function keepForRetry(draft: TDraft) {
    const key = keyOf(draft);

    if (!waiting.some((other) => keyOf(other) === key)) {
      waiting.unshift(draft);
    }
  }

  function scheduleRetry() {
    const delay = getRetryDelay(attempt);
    attempt += 1;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      void sendNext();
    }, delay);
  }

  function halt() {
    stopped = true;
    generation += 1;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    waiting.length = 0;
    sending = null;
    attempt = 0;
    resolveIdle(false);
  }

  function finishAttempt(draft: TDraft, outcome: DraftSaveOutcome | null): boolean {
    if (outcome !== "saved") {
      onFailed(draft);
    }

    if (outcome === "stopped") {
      halt();
      onStatus(getStatus());
      return false;
    }

    if (outcome === null) {
      keepForRetry(draft);
      scheduleRetry();
      settle();
      return false;
    }

    attempt = 0;

    if (outcome === "saved") {
      refused.delete(keyOf(draft));
      onStored(draft);
    } else {
      refused.add(keyOf(draft));
      onRefused?.(draft);
    }

    return true;
  }

  async function sendNext(): Promise<void> {
    const draft = stopped || sending !== null || retryTimer ? undefined : waiting.shift();

    if (draft === undefined) {
      settle();
      return;
    }

    const run = generation;
    sending = draft;
    settle();

    const outcome = await save(draft).then(
      (result) => result,
      () => null,
    );

    if (stopped || run !== generation) {
      return;
    }

    sending = null;

    if (finishAttempt(draft, outcome)) {
      await sendNext();
    }
  }

  return {
    add(draft: TDraft) {
      if (stopped) {
        return;
      }

      enqueueDraft(waiting, draft, keyOf);
      void sendNext();
    },
    /** A handed-in section's answers can't be saved again, so its refusals have nothing left to ask. */
    forgetRefusals() {
      refused.clear();
      settle();
    },
    /** Resolves true once every answer given so far is stored or refused, or false if stopped first. */
    idle(): Promise<boolean> {
      if (stopped) {
        return Promise.resolve(false);
      }

      if (!isBusy()) {
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
    isBusy,
    retryNow() {
      if (stopped || !retryTimer) {
        return;
      }

      clearTimeout(retryTimer);
      retryTimer = null;
      void sendNext();
    },
    start() {
      stopped = false;
    },
    /** Ends this screen's retry loop without clearing what the device already kept. */
    stop: halt,
  };
}
