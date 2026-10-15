import { type LearnerIdentity } from "@zoonk/core/learner/summary/contract";
import { type LearnerSummarySeedValue, isSameIdentity } from "./learner-snapshot";

/**
 * The pages on screen: whose session they were drawn for (`drawnFor`: the last page's seed, null
 * for nobody, or whoever held it when they last read themselves again; undefined while no page
 * said, as on a static page), the learner this tab made a session for itself until it's first read
 * (`adopted`, a new guest), the page that made it (`madeOn`), and what reads them again.
 */
const pages: {
  adopted: string | null;
  drawnFor: LearnerIdentity | null | undefined;
  listeners: Set<() => void>;
  madeOn: { path: string; userId: string } | null;
} = { adopted: null, drawnFor: undefined, listeners: new Set(), madeOn: null };

/**
 * Notes whose session a page's seed was read for: the page came with it, whoever holds it now. On
 * the page that made this tab's own new learner, a seed for anyone else is that page's own render
 * from before them, late to arrive: the page goes on as the new learner.
 */
export function notePageSeed(seed: LearnerSummarySeedValue): void {
  if (seed.status === "failed") {
    return;
  }

  const identity = seed.status === "ready" ? seed.summary.identity : null;
  const { madeOn } = pages;

  if (madeOn && madeOn.path === location.pathname && identity?.userId !== madeOn.userId) {
    return;
  }

  pages.madeOn = null;
  pages.drawnFor = identity;
}

/**
 * Says the page on screen made a session of its own for `userId` (a new guest): it goes on as them,
 * so the first read that finds them doesn't read the pages again.
 */
export function adoptNewSession(userId: string): void {
  pages.adopted = userId;
  pages.madeOn = { path: location.pathname, userId };
}

/** The pages read themselves again, now for whoever holds the session (`held`). */
export function redrawPages(held: LearnerIdentity | null | undefined): void {
  pages.adopted = null;
  pages.madeOn = null;
  pages.drawnFor = held;
  pages.listeners.forEach((listener) => listener());
}

/**
 * After a read with the cookies of now, the pages read themselves again when they were drawn for
 * another session than the one held: another tab signed in or out (a signed-out page's "Log in"
 * included), or the router kept a page drawn for someone else.
 */
export function redrawStalePages(held: LearnerIdentity | null | undefined): void {
  if (held && held.userId === pages.adopted) {
    pages.adopted = null;
    pages.drawnFor = held;
    return;
  }

  if (pages.drawnFor !== undefined && held !== undefined && !isSameIdentity(pages.drawnFor, held)) {
    redrawPages(held);
  }
}

/** Runs when the pages read themselves again: the session they showed isn't the one held. */
export function onLearnerIdentityChange(listener: () => void): () => void {
  pages.listeners.add(listener);
  return () => pages.listeners.delete(listener);
}
