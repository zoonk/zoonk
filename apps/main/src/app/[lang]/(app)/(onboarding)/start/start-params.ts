/** Where "Start over" lands: `/start` with a fresh key, so the first screen starts empty. */
export const START_AGAIN_PARAM = "again";

/** A goal the learner typed and is confirming, so a refresh or a link shows the same screen. */
export const DRAFT_PARAM = "draft";

/** `/start` showing a draft: the wait while it's read, what was understood, or its retry. */
export function getDraftHref(draftId: string) {
  return `/start?${DRAFT_PARAM}=${encodeURIComponent(draftId)}` as const;
}
