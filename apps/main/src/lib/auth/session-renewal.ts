import {
  SESSION_COPY_REFRESH_MS,
  SESSION_RENEWAL_PATH,
  SESSION_RENEWAL_REQUEST,
  isSessionRenewalDue,
} from "@zoonk/auth/session-renewal";
import { safeAsync } from "@zoonk/utils/error";

/** When this browser last renewed its session, shared by all its tabs. */
const RENEWED_AT_KEY = "zoonk-session-renewed-at";
/** When this browser last got a new copy of its session (every renewal POST writes one), shared by all its tabs. */
const COPIED_AT_KEY = "zoonk-session-copied-at";
/** Held by the tab that's renewing, so the browser's other tabs don't renew too. */
const RENEWAL_LOCK = "zoonk-session-renewal";
const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MINUTES = 5;
const RETRY_MS = RETRY_MINUTES * 60 * 1000;
/** A page counts as in use for this long after the learner's last tap, click or key. */
const IN_USE_MINUTES = 5;
const IN_USE_MS = IN_USE_MINUTES * 60 * 1000;
/** A renewal that hangs this long fails, and is tried again like any other. */
const RENEWAL_TIMEOUT_MS = 30_000;
/** What shows the learner is using the page. */
const INTERACTIONS = ["keydown", "pointerdown"] as const;

type RecordKey = typeof COPIED_AT_KEY | typeof RENEWED_AT_KEY;

/**
 * This page's own records beside the browser's: a page whose storage is blocked still renews once
 * a day and keeps its copy of the session, a renewal that failed waits a few minutes before the
 * next try, and the learner's last tap, click or key tells whether the page is in use.
 */
const page = {
  failedAt: 0,
  interactedAt: 0,
  records: { [COPIED_AT_KEY]: 0, [RENEWED_AT_KEY]: 0 } satisfies Record<RecordKey, number>,
};

/**
 * Whether `at` is less than `windowMs` ago. A time ahead of the clock (saved while the device's
 * clock was fast, then corrected) or no time at all (a stored value that isn't a number) is no
 * record, so it never holds a renewal back.
 */
function isWithin({ at, now, windowMs }: { at: number; now: number; windowMs: number }) {
  return at <= now && now - at < windowMs;
}

/** Storage that throws (blocked by the browser) reads as nothing. */
function tryStorage<Value>(access: () => Value): { data?: Value } {
  try {
    return { data: access() };
  } catch {
    return {};
  }
}

/** Whether this page, or any tab of the browser, wrote the record `key` less than `windowMs` ago. */
function wasRecordedWithin({
  key,
  now,
  windowMs,
}: {
  key: RecordKey;
  now: number;
  windowMs: number;
}) {
  const { data: stored } = tryStorage(() => Number(localStorage.getItem(key)));

  return [page.records[key], stored ?? 0].some((at) => isWithin({ at, now, windowMs }));
}

function writeRecord({ at, key }: { at: number; key: RecordKey }) {
  page.records[key] = at;
  tryStorage(() => localStorage.setItem(key, String(at)));
}

/** The session is a day old and the browser didn't renew it today. */
function isRenewalDue({ now, sessionEnd }: { now: number; sessionEnd: number }) {
  return (
    isSessionRenewalDue({ expiresAt: sessionEnd, now }) &&
    !wasRecordedWithin({ key: RENEWED_AT_KEY, now, windowMs: DAY_MS })
  );
}

/** The learner is using this page, and the browser's copy of the session is about to run out. */
function isCopyRefreshDue(now: number) {
  return (
    isWithin({ at: page.interactedAt, now, windowMs: IN_USE_MS }) &&
    !wasRecordedWithin({ key: COPIED_AT_KEY, now, windowMs: SESSION_COPY_REFRESH_MS })
  );
}

/** A visible tab of a learner, outside a retry's wait, whose session is due or whose copy is. */
function isRenewalWanted({ now, sessionEnd }: { now: number; sessionEnd: number | null }) {
  return (
    sessionEnd !== null &&
    document.visibilityState === "visible" &&
    !isWithin({ at: page.failedAt, now, windowMs: RETRY_MS }) &&
    (isRenewalDue({ now, sessionEnd }) || isCopyRefreshDue(now))
  );
}

/**
 * Runs `work` once this tab holds the renewal lock, after the tab renewing before it is done, so
 * `work` checks again whether it's still wanted: skipped once that tab renewed, tried here once
 * that tab failed or closed. Without Web Locks, or with storage blocked, sharing the day's renewal
 * between tabs is best effort: each tab can send its own.
 */
async function withRenewalLock(work: () => Promise<void>): Promise<void> {
  if (!("locks" in navigator)) {
    return work();
  }

  await navigator.locks.request(RENEWAL_LOCK, work);
}

/** Whether the server renewed (or kept) the session; an error answer or no answer is a failure. */
async function renew(): Promise<boolean> {
  const { data: response } = await safeAsync(() =>
    fetch(SESSION_RENEWAL_PATH, {
      ...SESSION_RENEWAL_REQUEST,
      credentials: "same-origin",
      signal: AbortSignal.timeout(RENEWAL_TIMEOUT_MS),
    }),
  );

  return response?.ok === true;
}

/**
 * Keeps the browser's session going while it's used. Reads never renew it (a GET never does),
 * so once the learner summary shows the session is a day old, one visible tab of the browser POSTs
 * the renewal; its response carries the renewed session cookie and the session hint beside it.
 * The same POST, for a session that isn't due, writes only a new copy of the session (the cookie
 * pages read instead of the database, which a page can't write): a tab the learner is using sends
 * it once the browser's copy is about to run out, so a learner using the app sends about one every
 * 50 minutes and an idle or hidden tab none. A renewal counts once it succeeded: one that failed
 * (offline, an error answer) is tried again a few minutes later, since a session that's due can be
 * about to end. `readSessionEnd` is when the learner's session ends, null without one; `subscribe`
 * calls back when that may have changed. Watches until the returned function stops it.
 */
export function watchSessionRenewal({
  readSessionEnd,
  subscribe,
}: {
  readSessionEnd: () => number | null;
  subscribe: (listener: () => void) => () => void;
}): () => void {
  const watch: { stopped: boolean; timer?: ReturnType<typeof setTimeout> } = { stopped: false };

  const isWanted = () =>
    !watch.stopped && isRenewalWanted({ now: Date.now(), sessionEnd: readSessionEnd() });

  const renewIfDue = () => {
    if (!isWanted()) {
      return;
    }

    // The browser can refuse the lock, or drop a waiting claim when it puts the page away: that's
    // tried again later, like a failed renewal.
    void withRenewalLock(async () => {
      // Another tab may have renewed, or this page closed, while it waited for the lock.
      if (!isWanted()) {
        return;
      }

      // The server renews a due session whichever reason sent the POST.
      const sessionEnd = readSessionEnd();
      const renewing = sessionEnd !== null && isRenewalDue({ now: Date.now(), sessionEnd });

      // Waiting for the answer counts as a try, so nothing in this page asks again meanwhile.
      page.failedAt = Date.now();

      if (await renew()) {
        const at = Date.now();
        page.failedAt = 0;
        writeRecord({ at, key: COPIED_AT_KEY });

        if (renewing) {
          writeRecord({ at, key: RENEWED_AT_KEY });
        }

        return;
      }

      page.failedAt = Date.now();
      retryLater();
    }).catch(retryLater);
  };

  // A page that closed meanwhile asks nothing more; the next page will.
  const retryLater = () => {
    if (!watch.stopped) {
      clearTimeout(watch.timer);
      watch.timer = setTimeout(renewIfDue, RETRY_MS);
    }
  };

  const noteInteraction = () => {
    page.interactedAt = Date.now();
    renewIfDue();
  };

  const unsubscribe = subscribe(renewIfDue);
  document.addEventListener("visibilitychange", renewIfDue);

  for (const type of INTERACTIONS) {
    document.addEventListener(type, noteInteraction, { capture: true, passive: true });
  }

  renewIfDue();

  return () => {
    watch.stopped = true;
    unsubscribe();
    document.removeEventListener("visibilitychange", renewIfDue);

    for (const type of INTERACTIONS) {
      document.removeEventListener(type, noteInteraction, { capture: true });
    }

    clearTimeout(watch.timer);
  };
}
