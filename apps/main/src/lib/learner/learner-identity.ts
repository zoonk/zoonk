import { SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { type IdentityCover, type IdentityHandoff } from "./identity-cover";
import {
  CHANNEL_NAME,
  type LearnerStoreBarrier,
  type OwnChange,
  armCheck,
  checkOnReturn,
  checkSession,
  coverPage,
  decide,
  isTag,
  noteOwner,
  record,
  retryCheck,
  wakeOtherTabs,
} from "./identity-record";
import { hasSessionHint, readSessionHintTag } from "./session-hint";

/**
 * Who the page on screen may show, as the cover module, the router, the writes and the summary
 * store ask it (`identity-record.ts` holds the record and decides): the browser's events and this
 * tab's own auth changes come in here, and one synchronous check answers.
 */

function onVisibilityChange() {
  if (document.visibilityState !== "visible") {
    return;
  }

  if (checkIdentity()) {
    checkOnReturn();
  } else if (record.check?.failed) {
    retryCheck();
  }
}

/** The window comes back to the learner: compare, then ask the server once (coalesced). */
function onFocus() {
  if (checkIdentity()) {
    checkOnReturn();
  }
}

function onPageShow(event: PageTransitionEvent) {
  if (checkIdentity() && event.persisted) {
    checkOnReturn();
  }
}

function onCookieChange(event: Event) {
  const { changed = [], deleted = [] } = event as Event & {
    changed?: readonly { name?: string }[];
    deleted?: readonly { name?: string }[];
  };

  if ([...changed, ...deleted].some((cookie) => cookie.name === SESSION_HINT_COOKIE)) {
    checkIdentity();
  }
}

function listen() {
  document.addEventListener("visibilitychange", onVisibilityChange);
  globalThis.addEventListener("pageshow", onPageShow);
  globalThis.addEventListener("focus", onFocus);
  globalThis.addEventListener("online", retryCheck);

  const { cookieStore } = globalThis as { cookieStore?: EventTarget };
  cookieStore?.addEventListener("change", onCookieChange);

  if ("BroadcastChannel" in globalThis) {
    record.channel = new BroadcastChannel(CHANNEL_NAME);
    record.channel.addEventListener("message", () => checkIdentity());
  }
}

/**
 * Starts the record once, in the browser: the hint as it reads now (the cover module's handoff,
 * when it comes, says what the page was parsed with), the listeners, and a word to the other tabs
 * that this page loaded with whatever session the browser holds.
 */
function start(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (!record.started) {
    record.started = true;
    record.hint = readSessionHintTag();
    listen();
    wakeOtherTabs();
  }

  return true;
}

/** Takes what the cover module's parse-time bootstrap found: the hint then, and the witnesses. */
function takeHandoff({ seen, witnesses }: IdentityHandoff) {
  record.hint = seen;

  if (isTag(seen)) {
    noteOwner(seen);
  }

  witnesses.forEach((tag) => noteOwner(tag));
  decide(readSessionHintTag());
}

/** Draws on the cover module what the store decided before it registered. */
function drawDecided(cover: IdentityCover) {
  if (record.terminal && record.transition) {
    cover.reset(record.transition);
  } else if (record.check?.failed) {
    cover.coverFailed(retryCheck);
  } else if (record.covered) {
    cover.cover();
  } else {
    // The page may show: a cover the bootstrap drew at parse comes off (and its reset guard learns
    // the page went on).
    cover.uncover();
  }
}

/**
 * Registers the cover/bootstrap module with what its parse-time bootstrap found. Once per page:
 * the store decides on it at once, so the cover ends up reset, checking, or off.
 */
export function registerIdentityCover(input: {
  cover: IdentityCover;
  handoff: IdentityHandoff;
}): void {
  if (!start()) {
    return;
  }

  takeHandoff(input.handoff);

  if (!record.cover) {
    record.cover = input.cover;
    drawDecided(input.cover);
  }
}

/**
 * A private boundary's witness: the tag of the session its output was rendered for (from the same
 * read as that output). Each independently revealed or retained private boundary notes it, in a
 * layout effect before its paint, and again when a retained page becomes active. A tag other than
 * the browser's hint, or than the page's first owner, decides a departure (cover + reload).
 */
export function noteWitness(tag: string): void {
  if (!start() || record.terminal) {
    return;
  }

  noteOwner(tag);
  decide(readSessionHintTag());
}

/**
 * Compares the browser's hint with what the page was drawn for, synchronously and without a
 * network read. `false` means the page may not go on: a departure was decided (now or before), or
 * the page is covered while this tab checks who holds the session. The caller cancels what it was
 * about to do (a navigation, a refresh, a write). `true` means the page may go on.
 */
export function checkIdentity(): boolean {
  return !start() || decide(readSessionHintTag());
}

/**
 * A read the store sent with the cookies of now said whose session it found (`tag`; null for
 * nobody). A learner's is drawn (the frame shows them), so it counts as a witness. Nobody, on a
 * page held for a learner or while the hint still says there's a session, asks Better Auth's own
 * session read: only its answer clears the hint with the session (the summary's can't), so the
 * next page doesn't take the old hint for a session.
 */
export function noteSessionAnswer(tag: string | null): void {
  if (tag !== null) {
    noteWitness(tag);
  } else if (record.owner !== null || hasSessionHint()) {
    checkSession();
  }
}

/** This tab's own auth change, from its start until it settles (`beginLocalAuthChange`). */
export type LocalAuthChange = {
  /**
   * The change succeeded for `actor` (the new guest's id, or null after a sign-out or deletion),
   * whose own response carried `tag` (null after a sign-out). A guest goes on only when the browser
   * still holds that tag (`true`); otherwise another tab changed the session meanwhile (`false`:
   * the caller doesn't continue as the guest). A sign-out or deletion covers the page and tells
   * the other tabs before the page leaves.
   */
  complete: (result: { actor: string | null; tag: string | null }) => boolean;
  /** Ends the change whatever happened (call it in `finally`); a change that never completed leaves the page as it was. */
  release: () => void;
};

function completeChange(
  change: OwnChange,
  { actor, tag }: { actor: string | null; tag: string | null },
): boolean {
  if (record.ownChange !== change || record.terminal) {
    return false;
  }

  if (actor === null) {
    change.signedOut = true;

    // The page leaves for the signed-out pages; until then nothing of the learner's shows. Never a
    // reload here: it would race the way out. A page still here once a check's time is up (central
    // sign-out failing or hanging, cleanup that never ends) says it couldn't check, so the learner
    // is never left behind a cover with nothing to press.
    if (record.owner !== null) {
      record.leaving = true;
      coverPage();
      armCheck();
    }

    wakeOtherTabs();
    return true;
  }

  const now = readSessionHintTag();

  if (tag === null || now !== tag) {
    return false;
  }

  record.hint = now;

  if (record.owner === null) {
    record.owner = tag;
    record.guestPage = globalThis.location.pathname;
  }

  wakeOtherTabs();
  return record.owner === tag;
}

function releaseChange(change: OwnChange) {
  if (record.ownChange !== change) {
    return;
  }

  record.ownChange = null;

  if (record.terminal) {
    return;
  }

  // A page this tab signed out of keeps the deadline its completion started.
  if (!change.signedOut) {
    decide(readSessionHintTag());
  }
}

/**
 * This tab starts changing who holds the session itself (making its guest, signing out, deleting
 * the account), synchronously, before any await: the reads and seeds of before stop counting, and
 * the hint changing under the tab's own response raises no alarm until the change settles.
 */
export function beginLocalAuthChange(): LocalAuthChange {
  start();
  const change: OwnChange = { signedOut: false };

  record.ownChange = change;
  record.epoch += 1;
  record.barrier?.();

  return {
    complete: (result) => completeChange(change, result),
    release: () => releaseChange(change),
  };
}

/**
 * Whether the page now shown is the first one after this tab made its own guest elsewhere: it
 * reads itself again once (the router may hold it as drawn for nobody).
 */
export function takeOwnGuestPageRead(): boolean {
  if (record.guestPage === null || record.guestPage === globalThis.location.pathname) {
    return false;
  }

  record.guestPage = null;
  return true;
}

/** Runs when the identity held changes in place (a page drawn for nobody, now a learner's). */
export function onLearnerIdentityChange(listener: () => void): () => void {
  record.listeners.add(listener);
  return () => record.listeners.delete(listener);
}

/** The summary store's barrier for this tab's own auth change, connected once when it loads. */
export function connectLearnerStore(barrier: LearnerStoreBarrier): void {
  record.barrier = barrier;
}

/** Tells the other tabs to compare the hint again (`endLearnerSession`, once a session ended). */
export function wakeLearnerTabs(): void {
  // A record starting now tells the other tabs as it starts: once is enough.
  if (record.started) {
    wakeOtherTabs();
  } else {
    start();
  }
}
