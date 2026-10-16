import {
  SESSION_RENEWAL_PATH,
  SESSION_RENEWAL_REQUEST,
  isSessionRenewalDue,
} from "@zoonk/auth/session-renewal";
import { safeAsync } from "@zoonk/utils/error";

/** When this browser last renewed its session, shared by all its tabs. */
const RENEWED_AT_KEY = "zoonk-session-renewed-at";
/** Held by the tab that's renewing, so the browser's other tabs don't renew too. */
const RENEWAL_LOCK = "zoonk-session-renewal";
const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MINUTES = 5;
const RETRY_MS = RETRY_MINUTES * 60 * 1000;
/** A renewal that hangs this long fails, and is tried again like any other. */
const RENEWAL_TIMEOUT_MS = 30_000;

/**
 * This page's own record beside the browser's: a page whose storage is blocked still renews once
 * a day, and a renewal that failed waits a few minutes before the next try.
 */
const page = { failedAt: 0, renewedAt: 0 };

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

function wasRenewedToday(now: number): boolean {
  const { data: stored } = tryStorage(() => Number(localStorage.getItem(RENEWED_AT_KEY)));

  return [page.renewedAt, stored ?? 0].some((renewedAt) =>
    isWithin({ at: renewedAt, now, windowMs: DAY_MS }),
  );
}

function writeRenewedAt(renewedAt: number) {
  page.renewedAt = renewedAt;
  tryStorage(() => localStorage.setItem(RENEWED_AT_KEY, String(renewedAt)));
}

/** A visible tab whose session is a day old and wasn't renewed today, outside a retry's wait. */
function isRenewalWanted({ now, sessionEnd }: { now: number; sessionEnd: number | null }) {
  return (
    sessionEnd !== null &&
    document.visibilityState === "visible" &&
    !isWithin({ at: page.failedAt, now, windowMs: RETRY_MS }) &&
    isSessionRenewalDue({ expiresAt: sessionEnd, now }) &&
    !wasRenewedToday(now)
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
 * A renewal counts once it succeeded: one that failed (offline, an error answer) is tried again a
 * few minutes later, since a session that's due can be about to end. `readSessionEnd` is when the
 * learner's session ends, null without one; `subscribe` calls back when that may have changed.
 * Watches until the returned function stops it.
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

      // Waiting for the answer counts as a try, so nothing in this page asks again meanwhile.
      page.failedAt = Date.now();

      if (await renew()) {
        page.failedAt = 0;
        writeRenewedAt(Date.now());
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

  const unsubscribe = subscribe(renewIfDue);
  document.addEventListener("visibilitychange", renewIfDue);
  renewIfDue();

  return () => {
    watch.stopped = true;
    unsubscribe();
    document.removeEventListener("visibilitychange", renewIfDue);
    clearTimeout(watch.timer);
  };
}
