/** `refused` holds until every refused question's answer is stored. */
export type DraftSaveStatus = "refused" | "retrying" | "saved" | "saving";

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 15_000;
const RETRY_BACKOFF = 2;

function getRetryDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * RETRY_BACKOFF ** attempt, LONGEST_RETRY_MS);
}

/** Keeps the newest draft for each key in queue order. */
function collectPending<TDraft>(
  items: readonly TDraft[],
  keyOf: (draft: TDraft) => string,
): TDraft[] {
  const result: TDraft[] = [];
  const indexes = new Map<string, number>();

  for (const draft of items) {
    const key = keyOf(draft);
    const index = indexes.get(key);

    if (index === undefined) {
      indexes.set(key, result.length);
      result.push(draft);
    } else {
      result[index] = draft;
    }
  }

  return result;
}

type DraftSaveQueueOptions<TDraft> = {
  keyOf: (draft: TDraft) => string;
  /** A refused answer, or one that didn't get through; it stays failed until it's stored. */
  onFailed: (draft: TDraft) => void;
  /** Runs whenever the unsent drafts change, so the device can keep them. */
  onPendingChange?: (pending: TDraft[]) => void;
  onStatus: (status: DraftSaveStatus) => void;
  onStored: (draft: TDraft) => void;
  /** True once stored, false when refused; rejects when it didn't get through. */
  save: (draft: TDraft) => Promise<boolean>;
};

/**
 * Sends answers in order, so an older answer never lands after a newer one, and retries one that
 * couldn't reach the server before what follows.
 */
export function createDraftSaveQueue<TDraft>({
  keyOf,
  onFailed,
  onPendingChange,
  onStatus,
  onStored,
  save,
}: DraftSaveQueueOptions<TDraft>) {
  const waiting: TDraft[] = [];
  const idleWaiters: (() => void)[] = [];
  let sending: TDraft | null = null;
  let attempt = 0;
  const refused = new Set<string>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let generation = 0;
  let pendingListener = onPendingChange;

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

  /** The newest draft for each key not stored yet, the one going out included, in queue order. */
  function pending(): TDraft[] {
    return collectPending(sending === null ? waiting : [sending, ...waiting], keyOf);
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
    if (stopped || sending !== null || retryTimer) {
      settle();
      return;
    }

    const draft = waiting.shift();

    if (draft === undefined) {
      settle();
      return;
    }

    const run = generation;
    sending = draft;
    settle();

    const stored = await save(draft).then(
      (ok) => ok,
      () => null,
    );

    if (stopped || run !== generation) {
      return;
    }

    sending = null;

    if (!stored) {
      onFailed(draft);
    }

    if (stored === null) {
      keepForRetry(draft);
      scheduleRetry();
      settle();
      return;
    }

    attempt = 0;

    if (stored) {
      refused.delete(keyOf(draft));
      onStored(draft);
    } else {
      refused.add(keyOf(draft));
    }

    pendingListener?.(pending());
    await sendNext();
  }

  return {
    add(draft: TDraft) {
      if (stopped) {
        return;
      }

      const key = keyOf(draft);
      const index = waiting.findIndex((other) => keyOf(other) === key);

      if (index === -1) {
        waiting.push(draft);
      } else {
        waiting[index] = draft;
      }

      pendingListener?.(pending());
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
    pending,
    retryNow() {
      if (stopped || !retryTimer) {
        return;
      }

      clearTimeout(retryTimer);
      retryTimer = null;
      void sendNext();
    },
    setPendingListener(listener: ((pending: TDraft[]) => void) | undefined) {
      pendingListener = listener;
    },
    start() {
      stopped = false;
    },
    /** Ends this screen's retry loop without clearing what the device already kept. */
    stop() {
      stopped = true;
      generation += 1;

      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      waiting.length = 0;
      sending = null;
      attempt = 0;
      idleWaiters.splice(0).forEach((resolve) => resolve());
    },
  };
}
