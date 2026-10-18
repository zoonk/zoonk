import { SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { readCookie } from "@zoonk/utils/cookies";

const CHANNEL_NAME = "zoonk-auth";

/** Left by a sign-in's callback for the page it lands on, which tells the browser's other tabs. */
export const SIGNED_IN_COOKIE = "zoonk-signed-in-now";

/**
 * The page's one channel to the other tabs: a channel never hears its own messages, so the page
 * that announces a change doesn't reload itself.
 */
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  channel ??= "BroadcastChannel" in globalThis ? new BroadcastChannel(CHANNEL_NAME) : null;
  return channel;
}

/**
 * Tells the browser's other tabs that the session changed (a sign-in, a sign-out, a deleted
 * account): each reloads, so none keeps showing the learner from before.
 */
export function announceAuthChange(): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A BroadcastChannel has no target origin.
  getChannel()?.postMessage(null);
}

function reload() {
  location.reload();
}

/**
 * Reloads the page once the session changes elsewhere: another tab says so (`announceAuthChange`),
 * or the page comes back from the back/forward cache with another session hint than it loaded
 * with. The page a sign-in lands on tells the other tabs. Returns the cleanup. Browser only.
 */
export function reloadOnAuthChange(): () => void {
  const loadedWith = readCookie(SESSION_HINT_COOKIE);

  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted && readCookie(SESSION_HINT_COOKIE) !== loadedWith) {
      reload();
    }
  }

  getChannel()?.addEventListener("message", reload);
  globalThis.addEventListener("pageshow", onPageShow);

  if (readCookie(SIGNED_IN_COOKIE) !== null) {
    // Dropped before the other tabs hear it, so their reloads don't tell anyone again.
    // oxlint-disable-next-line unicorn/no-document-cookie -- Synchronous, before the announcement.
    document.cookie = `${SIGNED_IN_COOKIE}=; path=/; max-age=0`;
    announceAuthChange();
  }

  return () => {
    getChannel()?.removeEventListener("message", reload);
    globalThis.removeEventListener("pageshow", onPageShow);
  };
}
