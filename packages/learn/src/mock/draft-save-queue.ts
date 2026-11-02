/** `refused` holds until a later answer is stored. */
export type DraftSaveStatus = "refused" | "retrying" | "saved" | "saving";

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 15_000;
const RETRY_BACKOFF = 2;

function getRetryDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * RETRY_BACKOFF ** attempt, LONGEST_RETRY_MS);
}

/**
 * Sends answers in order, so an older answer never lands after a newer one, and retries one that
 * couldn't reach the server before what follows.
 */
export function createDraftSaveQueue<TDraft>({
  keyOf,
  onStatus,
  save,
}: {
  keyOf: (draft: TDraft) => string;
  onStatus: (status: DraftSaveStatus) => void;
  /** True once stored, false when refused; rejects when it didn't get through. */
  save: (draft: TDraft) => Promise<boolean>;
}) {
  const waiting: TDraft[] = [];
  const idleWaiters: (() => void)[] = [];
  let sending = false;
  let attempt = 0;
  let refused = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function getStatus(): DraftSaveStatus {
    if (retryTimer) {
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

  async function sendNext(): Promise<void> {
    const draft = waiting.shift();

    if (sending || retryTimer || draft === undefined) {
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
    isBusy,
    retryNow() {
      if (!retryTimer) {
        return;
      }

      clearTimeout(retryTimer);
      retryTimer = null;
      void sendNext();
    },
  };
}
