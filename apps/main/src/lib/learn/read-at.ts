import "server-only";
import { getLearnerRevision } from "@zoonk/core/learner/revision";

/**
 * When the page's private reads ran, in milliseconds since the epoch. Read inside the same private
 * cache as the page's data, so a prefetched copy keeps the time it was prefetched and the page can
 * tell how old the copy it shows is (`useRefreshWhenOld`).
 */
export async function getReadAt(): Promise<number> {
  "use cache: private";
  return Date.now();
}

/** When a page's private reads ran, and the learner revision read before them. */
export type ReadStamp = { readAt: number; revision: string | null };

/**
 * When the page's private reads ran and the learner's revision, kept in the same private cache as
 * the page's data, so a prefetched copy keeps both: shown later, the page asks whether the learner
 * changed anything since, here or on another device, or what it shows changed
 * (`useRefreshWhenOld`). Read it before the page's other reads, so the revision never claims more
 * than they show.
 */
export async function getReadStamp(): Promise<ReadStamp> {
  "use cache: private";

  const learner = await getLearnerRevision();
  return { readAt: Date.now(), revision: learner?.revision ?? null };
}
