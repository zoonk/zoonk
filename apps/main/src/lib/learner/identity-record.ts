import { type IdentityCover, type IdentityTransition } from "./identity-cover";
import { SESSION_CHECK_TIMEOUT_MS, fetchSessionTag } from "./learner-session-check";
import { readSessionHintTag } from "./session-hint";

/**
 * The identity record (`learner-identity.ts` is its public face): who the page on screen was drawn for, as the session hint's opaque tag (`identity-cover.ts`): its
 * first owner (the learner the hint named when the page was parsed, else its first private
 * witness; sticky) and whether a later witness named another (`contaminated`; sticky). The hint
 * changes only with the browser's session cookie, so one synchronous compare tells whether the page
 * may go on: a page held for a learner whose hint now names someone else, or nobody, leaves
 * (covered, it reloads), and "the same learner again" never brings it back. A page held for nobody
 * goes on softly as whoever signs in. Only a hint that stops naming the owner covers the page while
 * the server says who holds the session (`startCheck`).
 */

export type Hint = string | null | undefined;

/** This tab's own check of who holds the session, while it covers the page. */
type Check = { failed: boolean; seq: number; timer: ReturnType<typeof setTimeout> | undefined };

/** This tab's own auth change, from `beginLocalAuthChange` until its `release`. */
export type OwnChange = { signedOut: boolean };

/** What the identity record asks of the summary store (`learner-summary-core.ts` connects it). */
export type LearnerStoreBarrier = () => void;

export const CHANNEL_NAME = "zoonk-learner";

/** Memory only, per document: a reload starts over (with the cover's reset guard). */
export const record: {
  barrier: LearnerStoreBarrier | null;
  channel: BroadcastChannel | null;
  check: Check | null;
  contaminated: boolean;
  cover: IdentityCover | null;
  covered: boolean;
  /** Bumped by each own change: a session check sent before it answers for nothing. */
  epoch: number;
  /** The address this tab made its own guest on, until the next page shown reads itself again. */
  guestPage: string | null;
  /** The hint as the page last read it. */
  hint: Hint;
  /** This tab signed its learner out: the page is covered until it leaves (or says it couldn't). */
  leaving: boolean;
  listeners: Set<() => void>;
  ownChange: OwnChange | null;
  owner: string | null;
  returnCheck: Promise<void> | null;
  seq: number;
  started: boolean;
  /** A departure was decided: the page reloads, or waits for Reload. Nothing else happens. */
  terminal: boolean;
  transition: IdentityTransition | null;
} = {
  barrier: null,
  channel: null,
  check: null,
  contaminated: false,
  cover: null,
  covered: false,
  epoch: 0,
  guestPage: null,
  hint: undefined,
  leaving: false,
  listeners: new Set(),
  ownChange: null,
  owner: null,
  returnCheck: null,
  seq: 0,
  started: false,
  terminal: false,
  transition: null,
};

export function isTag(hint: Hint): hint is string {
  return typeof hint === "string";
}

/** Tells the other tabs to compare the hint again (they never take another tab's word for who). */
export function wakeOtherTabs() {
  record.channel?.postMessage({ check: true });
}

export function coverPage() {
  record.covered = true;
  record.cover?.cover();
}

function clearCheck() {
  clearTimeout(record.check?.timer);
  record.check = null;
}

/** The page may show again: only a check that found its owner gets here. */
function uncoverPage() {
  clearCheck();

  if (record.covered) {
    record.covered = false;
    record.cover?.uncover();
  }
}

/** The page shows someone the browser doesn't hold now (`to`): it reloads, covered. */
function depart(to: Hint) {
  const transition: IdentityTransition = {
    contaminated: record.contaminated,
    from: record.owner,
    to: to ?? null,
  };

  record.terminal = true;
  record.transition = transition;
  record.covered = true;
  clearCheck();

  // Nothing read or written for the learner before lands any more: the page is leaving.
  record.barrier?.();
  record.cover?.reset(transition);
}

/** The check failed or ran out of time: the cover stays and offers Try again and Reload. */
function failCheck(seq: number) {
  if (record.terminal || record.check?.seq !== seq) {
    return;
  }

  clearTimeout(record.check.timer);
  record.check = { failed: true, seq, timer: undefined };
  record.cover?.coverFailed(retryCheck);
}

/** The server said whose session the browser holds (`tag`): the owner's uncovers, anyone else's departs. */
function settleCheck(seq: number, tag: string | null) {
  if (record.terminal || record.check?.seq !== seq) {
    return;
  }

  if (tag === record.owner && !record.contaminated) {
    uncoverPage();
    return;
  }

  wakeOtherTabs();
  depart(tag);
}

/** A check of this tab's own, which says it couldn't check unless it settles within ≈8 s. */
export function armCheck(): number {
  record.seq += 1;
  const { seq } = record;

  record.check = {
    failed: false,
    seq,
    timer: setTimeout(() => failCheck(seq), SESSION_CHECK_TIMEOUT_MS),
  };

  return seq;
}

/**
 * The hint stopped naming the page's owner: the page is covered while the server says who holds
 * the session (≈8 s at most, then Try again).
 */
function startCheck() {
  const seq = armCheck();
  coverPage();

  fetchSessionTag().then(
    (tag) => settleCheck(seq, tag),
    () => failCheck(seq),
  );
}

/**
 * Decides with what the hint says now, for a page that holds a learner: theirs (again) shows it, a
 * hint naming no one checks with the server when it named the owner before, anyone else departs.
 */
function decideForOwner(now: Hint, previous: Hint): boolean {
  if (record.contaminated) {
    depart(now);
    return false;
  }

  if (now === record.owner) {
    uncoverPage();
    return true;
  }

  if (now === undefined) {
    if (record.check) {
      return false;
    }

    if (isTag(previous)) {
      startCheck();
      return false;
    }

    // It never named anyone (a hint from before tags): the page's returns ask the server.
    return true;
  }

  depart(now);
  return false;
}

/** A page held for nobody, now someone's: it reads itself again for them, softly. */
function adoptSoftly() {
  record.listeners.forEach((listener) => listener());
}

/** Compares the hint now with what the page was drawn for. */
export function decide(now: Hint): boolean {
  // A page this tab signed out of waits to leave: Try again decides after ≈8 s (`retryCheck`).
  if (record.terminal || record.leaving) {
    return false;
  }

  if (record.contaminated) {
    depart(now);
    return false;
  }

  // The tab's own change rewrites the hint under it: no alarm until the change settles, and nothing
  // goes out while the hint isn't what it was when the change began (its own answer, or another
  // tab's sign-in, which the release then decides against that hint).
  if (record.ownChange) {
    return !record.covered && now === record.hint;
  }

  const previous = record.hint;
  record.hint = now;

  if (record.owner !== null) {
    return decideForOwner(now, previous);
  }

  if (isTag(now) && now !== previous) {
    adoptSoftly();
  }

  return true;
}

/**
 * Try again on a failed check (or the browser back online): the cover shows the check under way
 * again before anything is sent, then the hint decides, or the server when it names no one.
 */
export function retryCheck() {
  if (record.terminal || !record.check?.failed) {
    return;
  }

  record.leaving = false;
  clearCheck();

  const now = readSessionHintTag();
  record.hint = now;

  if (now === undefined) {
    startCheck();
    return;
  }

  coverPage();
  decideForOwner(now, now);
}

/**
 * One session read at a time, never covering: on a page held for a learner, anyone else's answer
 * (or nobody's) leaves the page, so a session the server ended (revoked, expired, signed out where
 * the hint couldn't hear) leaves it too. On a page held for nobody only its answer's cookies count
 * (a hint left without a session is cleared by it). A read that fails changes nothing.
 */
export function checkSession() {
  if (record.terminal || record.leaving || record.ownChange || record.check || record.returnCheck) {
    return;
  }

  const { epoch } = record;

  record.returnCheck = fetchSessionTag()
    .then(
      (tag) => {
        if (record.terminal || record.ownChange || record.check || epoch !== record.epoch) {
          return;
        }

        if (record.owner !== null && tag !== record.owner) {
          wakeOtherTabs();
          depart(tag);
        }
      },
      () => {
        // R7's accepted residual: a failed return read leaves the page as it is.
      },
    )
    .finally(() => {
      record.returnCheck = null;
    });
}

/** A private page's return (shown again, or restored from the browser's history) checks the session. */
export function checkOnReturn() {
  if (record.owner !== null) {
    checkSession();
  }
}

/** Notes that the page drew `tag`'s output: its first owner, or a second one (contaminated). */
export function noteOwner(tag: string) {
  if (record.owner === null) {
    record.owner = tag;
  } else if (tag !== record.owner) {
    record.contaminated = true;
  }
}
