/** `refused` holds until every refused question's answer is stored. */
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
  onFailed,
  onRefused,
  onStatus,
  onStored,
  save,
}: {
  keyOf: (draft: TDraft) => string;
  /** A refused answer, or one that didn't get through; it stays failed until it's stored. */
  onFailed: (draft: TDraft) => void;
  onRefused: (draft: TDraft) => void;
  onStatus: (status: DraftSaveStatus) => void;
  onStored: (draft: TDraft) => void;
  /** True once stored, false when refused; null or a rejection when it didn't get through. */
  save: (draft: TDraft) => Promise<boolean | null>;
}) {
  const waiting: TDraft[] = [];
  const idleWaiters: (() => void)[] = [];
  let sending = false;
  let attempt = 0;
  const refused = new Set<string>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function getStatus(): DraftSaveStatus {
    if (retryTimer) {
      return "retrying";
    }

    if (sending || waiting.length > 0) {
      return "saving";
    }

    return refused.size > 0 ? "refused" : "saved";
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

    if (stopped || sending || retryTimer || draft === undefined) {
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

    if (!stored) {
      onFailed(draft);
    }

    if (stored === null) {
      if (!stopped) {
        keepForRetry(draft);
        scheduleRetry();
      }

      settle();
      return;
    }

    attempt = 0;

    if (stored) {
      refused.delete(keyOf(draft));
      onStored(draft);
    } else {
      refused.add(keyOf(draft));
      onRefused(draft);
    }

    await sendNext();
  }

  return {
    add(draft: TDraft) {
      stopped = false;
      const key = keyOf(draft);
      const index = waiting.findIndex((other) => keyOf(other) === key);

      if (index === -1) {
        waiting.push(draft);
      } else {
        waiting[index] = draft;
      }

      void sendNext();
    },
    /** A handed-in section's answers can't be saved again, so its refusals have nothing left to ask. */
    forgetRefusals() {
      refused.clear();
      settle();
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
    /** Whether a newer answer to this key would take the place of one still in line. */
    isWaiting(key: string): boolean {
      return waiting.some((other) => keyOf(other) === key);
    },
    retryNow() {
      if (!retryTimer) {
        return;
      }

      clearTimeout(retryTimer);
      retryTimer = null;
      void sendNext();
    },
    /**
     * Holds sends until the next answer, so a closed screen's can't land after a reopened one's.
     * What was in line stays on the device, and a screen shown again sends it in the device's order.
     */
    stop() {
      stopped = true;
      waiting.length = 0;

      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    },
  };
}
