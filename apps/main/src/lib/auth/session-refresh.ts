import { SESSION_COPY_REFRESH_MS, SESSION_REFRESH_PATH } from "@zoonk/auth/session-refresh";
import { safeAsync } from "@zoonk/utils/error";

/** When this browser last got a new copy of its session, shared by all its tabs. */
const COPIED_AT_KEY = "zoonk-session-copied-at";
/** Held by the tab that's getting a new copy, so the browser's other tabs don't ask too. */
const REFRESH_LOCK = "zoonk-session-refresh";
const RETRY_MINUTES = 5;
const RETRY_MS = RETRY_MINUTES * 60 * 1000;
/** A page counts as in use for this long after the learner's last tap, click or key. */
const IN_USE_MINUTES = 5;
const IN_USE_MS = IN_USE_MINUTES * 60 * 1000;
/** A refresh that hangs this long fails, and is tried again like any other. */
const REFRESH_TIMEOUT_MS = 30_000;
/** What shows the learner is using the page. */
const INTERACTIONS = ["keydown", "pointerdown"] as const;

/**
 * This page's own records beside the browser's: a page whose storage is blocked still keeps its
 * copy of the session, a refresh that failed waits a few minutes before the next try, and the
 * learner's last tap, click or key tells whether the page is in use.
 */
const page = { copiedAt: 0, failedAt: 0, interactedAt: 0 };

/**
 * Whether `at` is less than `windowMs` ago. A time ahead of the clock (saved while the device's
 * clock was fast, then corrected) or no time at all (a stored value that isn't a number) is no
 * record, so it never holds a refresh back.
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

/** Whether this page, or any tab of the browser, got a copy recent enough to keep reading. */
function hasRecentCopy(now: number) {
  const { data: stored } = tryStorage(() => Number(localStorage.getItem(COPIED_AT_KEY)));

  return [page.copiedAt, stored ?? 0].some((at) =>
    isWithin({ at, now, windowMs: SESSION_COPY_REFRESH_MS }),
  );
}

function recordCopy(at: number) {
  page.copiedAt = at;
  tryStorage(() => localStorage.setItem(COPIED_AT_KEY, String(at)));
}

/**
 * A visible tab of a learner who used it in the last few minutes, outside a retry's wait, whose
 * browser's copy of the session is about to run out.
 */
function isRefreshWanted({ hasSession, now }: { hasSession: boolean; now: number }) {
  return (
    hasSession &&
    document.visibilityState === "visible" &&
    isWithin({ at: page.interactedAt, now, windowMs: IN_USE_MS }) &&
    !isWithin({ at: page.failedAt, now, windowMs: RETRY_MS }) &&
    !hasRecentCopy(now)
  );
}

/**
 * Runs `work` once this tab holds the refresh lock, after the tab refreshing before it is done, so
 * `work` checks again whether it's still wanted: skipped once that tab got a new copy, tried here
 * once that tab failed or closed. Without Web Locks, or with storage blocked, sharing the refresh
 * between tabs is best effort: each tab can send its own.
 */
async function withRefreshLock(work: () => Promise<void>): Promise<void> {
  if (!("locks" in navigator)) {
    return work();
  }

  await navigator.locks.request(REFRESH_LOCK, work);
}

/** Whether the server answered with a new copy; an error answer or no answer is a failure. */
async function refresh(): Promise<boolean> {
  const { data: response } = await safeAsync(() =>
    fetch(SESSION_REFRESH_PATH, {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    }),
  );

  return response?.ok === true;
}

/**
 * Keeps the browser's copy of the session (the cookie pages read instead of the database, which a
 * page can't write) from running out while the learner uses the app. A tab the learner tapped,
 * clicked or typed in during the last few minutes reads the session past its copy once the
 * browser's copy is about to run out, and the answer carries a new one. That read also renews a
 * session last renewed a day or more ago, with its cookie and the session hint beside it. A learner
 * using the app sends about one every 50 minutes, and an idle or hidden tab none. One that failed
 * (offline, an error answer) is tried again a few minutes later. `hasSession` tells whether the
 * page has a learner; `subscribe` calls back when that may have changed. Watches until the returned
 * function stops it.
 */
export function watchSessionRefresh({
  hasSession,
  subscribe,
}: {
  hasSession: () => boolean;
  subscribe: (listener: () => void) => () => void;
}): () => void {
  const watch: { stopped: boolean; timer?: ReturnType<typeof setTimeout> } = { stopped: false };

  const isWanted = () =>
    !watch.stopped && isRefreshWanted({ hasSession: hasSession(), now: Date.now() });

  const refreshIfDue = () => {
    if (!isWanted()) {
      return;
    }

    // The browser can refuse the lock, or drop a waiting claim when it puts the page away: that's
    // tried again later, like a failed refresh.
    void withRefreshLock(async () => {
      // Another tab may have refreshed, or this page closed, while it waited for the lock.
      if (!isWanted()) {
        return;
      }

      // Waiting for the answer counts as a try, so nothing in this page asks again meanwhile.
      page.failedAt = Date.now();

      if (await refresh()) {
        page.failedAt = 0;
        recordCopy(Date.now());
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
      watch.timer = setTimeout(refreshIfDue, RETRY_MS);
    }
  };

  const noteInteraction = () => {
    page.interactedAt = Date.now();
    refreshIfDue();
  };

  const unsubscribe = subscribe(refreshIfDue);
  document.addEventListener("visibilitychange", refreshIfDue);

  for (const type of INTERACTIONS) {
    document.addEventListener(type, noteInteraction, { capture: true, passive: true });
  }

  refreshIfDue();

  return () => {
    watch.stopped = true;
    unsubscribe();
    document.removeEventListener("visibilitychange", refreshIfDue);

    for (const type of INTERACTIONS) {
      document.removeEventListener(type, noteInteraction, { capture: true });
    }

    clearTimeout(watch.timer);
  };
}
